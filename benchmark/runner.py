"""
Experiment Benchmark Runner.
Executes automated, reproducible multi-trial evaluations across all 5 AI architectures.
Features:
- Deterministic seed generation (100000 + trial * 37)
- Standardized scenario loading with fixed entity spawns, crates, and healing shrines
- Headless accelerated time-stepping for high-throughput batch evaluation
- Progress reporting and cancel hooks
- Automated statistical aggregation and CSV logging
"""
import time
from typing import List, Dict, Optional, Callable, Any
from simulation.vector2 import Vector2
from simulation.entities import NPC
from simulation.simulation_engine import SimulationEngine
from simulation.scenarios import get_experiment_scenario, ScenarioConfig
from simulation.ai.factory import make_ai_engine
from benchmark.automated_bot import AutomatedBenchmarkBot
from benchmark.metrics_collector import (
    TrialResult,
    AggregatedMetrics,
    TrialMetricsTracker,
    compute_aggregates,
    export_trials_to_csv,
    export_aggregates_to_csv,
)

AI_LABELS = {
    "simple": "Simple Decision Logic (FSM)",
    "behavior_tree": "Behavior Tree (BT)",
    "fuzzy": "Fuzzy Logic Controller",
    "goap": "Goal-Oriented Action Planner (GOAP)",
    "utility": "Utility AI Response Curves",
}


class BenchmarkRunner:
    def __init__(self, width: float = 1000.0, height: float = 700.0):
        self.width = width
        self.height = height
        self.is_running = False
        self._cancel_requested = False

    def cancel(self):
        self._cancel_requested = True

    def run_trial(
        self,
        experiment_id: str,
        trial_number: int,
        ai_type: str,
        scenario_id: str,
        seed: int,
        dt: float = 0.033,  # ~30 FPS time-step
        max_duration_sec: Optional[float] = None,
    ) -> TrialResult:
        """
        Executes a single, strictly deterministic evaluation trial in headless mode.
        """
        scenario = get_experiment_scenario(scenario_id, self.width, self.height)
        time_limit = max_duration_sec if max_duration_sec is not None else scenario.time_limit_sec

        engine = SimulationEngine(width=self.width, height=self.height)
        engine.crates = list(scenario.crates)
        engine.heal_stations = list(scenario.heal_stations)

        # Player setup
        engine.player.x = scenario.player_start_pos.x
        engine.player.y = scenario.player_start_pos.y
        engine.player.vx = 0.0
        engine.player.vy = 0.0
        engine.player.health = scenario.player_initial_health
        engine.player.max_health = 100.0
        engine.player.pulse_cooldown = 0.0

        # NPC setup
        npc = NPC(
            id=f"npc_{ai_type}_trial_{trial_number}",
            ai_type=ai_type,
            x=scenario.npc_start_pos.x,
            y=scenario.npc_start_pos.y,
            name=AI_LABELS.get(ai_type, ai_type),
        )
        npc.health = scenario.npc_initial_health
        npc.max_health = 100.0
        npc.aggression_stamina = 4.0
        npc.is_exhausted = False

        controller = make_ai_engine(ai_type)
        engine.register_npc(npc, controller)

        tracker = TrialMetricsTracker(
            experiment_id=experiment_id,
            trial_number=trial_number,
            ai_type=ai_type,
            ai_label=AI_LABELS.get(ai_type, ai_type),
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            seed=seed,
            time_limit_sec=time_limit,
        )

        elapsed_sim_time = 0.0
        prev_player_health = engine.player.health
        prev_npc_health = npc.health

        while elapsed_sim_time < time_limit:
            # 1. Update automated benchmark opponent bot
            AutomatedBenchmarkBot.update(
                player=engine.player,
                npc=npc,
                crates=engine.crates,
                width=self.width,
                height=self.height,
                dt=dt,
                trigger_pulse_fn=lambda: engine.trigger_player_pulse(),
            )

            # 2. Step player physics & crate resolution
            # Speed clamping
            cur_speed = engine.player.vel.length()
            if cur_speed > engine.player.max_speed * 0.88:
                engine.player.vel = engine.player.vel.clamp_length(engine.player.max_speed * 0.88)

            engine.player.x += engine.player.vx * dt
            engine.player.y += engine.player.vy * dt

            p_half = engine.player.half_size
            for crate in engine.crates:
                from simulation.geometry import resolve_box_collision
                engine.player.pos = resolve_box_collision(engine.player.pos, p_half, crate)
            engine.player.x = max(p_half, min(self.width - p_half, engine.player.x))
            engine.player.y = max(p_half, min(self.height - p_half, engine.player.y))

            # 3. Step NPC AI, physics, and combat
            engine.step_npcs(dt)
            elapsed_sim_time += dt

            # 4. Record damages
            if engine.player.health < prev_player_health:
                dmg_dealt = prev_player_health - engine.player.health
                tracker.record_damage_dealt(dmg_dealt)
                prev_player_health = engine.player.health

            if npc.health < prev_npc_health:
                dmg_rcv = prev_npc_health - npc.health
                tracker.record_damage_received(dmg_rcv)
                prev_npc_health = npc.health
            elif npc.health > prev_npc_health:
                # Healing recovered
                prev_npc_health = npc.health

            # 5. Check retreat state
            badge = npc.debug_data.get("stateBadge", "")
            is_retreat = (
                npc.is_healing
                or npc.is_exhausted
                or "Tired" in badge
                or "Retreat" in badge
                or "Flee" in badge
                or "Stand-off" in badge
            )

            p_dist = npc.pos.distance(engine.player.pos)
            min_combat = (npc.size + engine.player.size) * 0.5
            is_melee_contact = p_dist <= min_combat + 4.0

            tracker.on_step(
                dt=dt,
                npc_pos=(npc.x, npc.y),
                npc_health=npc.health,
                player_health=engine.player.health,
                is_retreat_state=is_retreat,
                is_melee_contact=is_melee_contact,
            )

            # Termination conditions: death or timeout
            if engine.player.health <= 0.0 or npc.health <= 0.0:
                break

        return tracker.finalize(timestamp=time.time())

    def run_experiment(
        self,
        scenario_id: str = "open_arena",
        trials_per_ai: int = 5,
        ai_types: Optional[List[str]] = None,
        on_progress: Optional[Callable[[int, int, str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Executes a complete standardized evaluation across specified AI architectures.
        """
        self.is_running = True
        self._cancel_requested = False

        if not ai_types:
            ai_types = ["simple", "behavior_tree", "fuzzy", "goap", "utility"]

        scenario = get_experiment_scenario(scenario_id, self.width, self.height)
        experiment_id = f"exp_{int(time.time())}"
        total_trials = len(ai_types) * trials_per_ai

        results: List[TrialResult] = []
        completed = 0

        for ai_type in ai_types:
            if self._cancel_requested:
                break

            for t_idx in range(1, trials_per_ai + 1):
                if self._cancel_requested:
                    break

                seed = 100000 + t_idx * 37
                label = AI_LABELS.get(ai_type, ai_type)

                if on_progress:
                    on_progress(completed + 1, total_trials, f"{label} (Trial {t_idx}/{trials_per_ai})")

                result = self.run_trial(
                    experiment_id=experiment_id,
                    trial_number=t_idx,
                    ai_type=ai_type,
                    scenario_id=scenario_id,
                    seed=seed,
                )
                results.append(result)
                completed += 1

        self.is_running = False

        # Compute aggregates per AI
        aggregates: Dict[str, AggregatedMetrics] = {}
        for ai_type in ai_types:
            ai_trials = [r for r in results if r.ai_type == ai_type]
            label = AI_LABELS.get(ai_type, ai_type)
            aggregates[ai_type] = compute_aggregates(ai_type, label, ai_trials)

        return {
            "experimentId": experiment_id,
            "scenarioId": scenario.id,
            "scenarioName": scenario.name,
            "trialsPerAI": trials_per_ai,
            "totalTrials": total_trials,
            "completedTrials": completed,
            "results": [r.to_dict() for r in results],
            "rawResults": results,
            "aggregates": {k: v.to_dict() for k, v in aggregates.items()},
            "rawAggregates": list(aggregates.values()),
            "csvTrials": export_trials_to_csv(results),
            "csvAggregates": export_aggregates_to_csv(list(aggregates.values())),
        }
