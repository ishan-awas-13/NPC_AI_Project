"""
Trial Metrics Tracker & Statistical Aggregator.
Tracks survival time, damage dealt, damage received, attack contacts,
retreat transitions, distance travelled, and win/loss/draw outcomes.
Provides statistical calculations (mean, std dev, min, max) and RFC 4180 CSV export.
"""
import math
from typing import NamedTuple, List, Dict, Any, Optional


class TrialResult(NamedTuple):
    experiment_id: str
    trial_number: int
    ai_type: str
    ai_label: str
    scenario_id: str
    scenario_name: str
    seed: int
    survival_time: float
    damage_dealt: float
    damage_received: float
    npc_won: bool
    player_won: bool
    attacks: int
    retreats: int
    distance_travelled: float
    final_npc_health: float
    final_player_health: float
    outcome: str
    timestamp: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experimentId": self.experiment_id,
            "trialNumber": self.trial_number,
            "aiType": self.ai_type,
            "aiLabel": self.ai_label,
            "scenarioId": self.scenario_id,
            "scenarioName": self.scenario_name,
            "seed": self.seed,
            "survivalTime": self.survival_time,
            "damageDealt": self.damage_dealt,
            "damageReceived": self.damage_received,
            "npcWon": self.npc_won,
            "playerWon": self.player_won,
            "attacks": self.attacks,
            "retreats": self.retreats,
            "distanceTravelled": self.distance_travelled,
            "finalNpcHealth": self.final_npc_health,
            "finalPlayerHealth": self.final_player_health,
            "outcome": self.outcome,
            "timestamp": self.timestamp,
        }


class AggregatedMetrics(NamedTuple):
    ai_type: str
    ai_label: str
    trial_count: int
    mean_survival_time: float
    std_survival_time: float
    min_survival_time: float
    max_survival_time: float
    mean_damage_dealt: float
    std_damage_dealt: float
    min_damage_dealt: float
    max_damage_dealt: float
    mean_damage_received: float
    std_damage_received: float
    mean_attacks: float
    std_attacks: float
    mean_retreats: float
    std_retreats: float
    mean_distance_travelled: float
    std_distance_travelled: float
    npc_win_rate: float
    player_win_rate: float
    draw_rate: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "aiType": self.ai_type,
            "aiLabel": self.ai_label,
            "trialCount": self.trial_count,
            "meanSurvivalTime": self.mean_survival_time,
            "stdSurvivalTime": self.std_survival_time,
            "minSurvivalTime": self.min_survival_time,
            "maxSurvivalTime": self.max_survival_time,
            "meanDamageDealt": self.mean_damage_dealt,
            "stdDamageDealt": self.std_damage_dealt,
            "minDamageDealt": self.min_damage_dealt,
            "maxDamageDealt": self.max_damage_dealt,
            "meanDamageReceived": self.mean_damage_received,
            "stdDamageReceived": self.std_damage_received,
            "meanAttacks": self.mean_attacks,
            "stdAttacks": self.std_attacks,
            "meanRetreats": self.mean_retreats,
            "stdRetreats": self.std_retreats,
            "meanDistanceTravelled": self.mean_distance_travelled,
            "stdDistanceTravelled": self.std_distance_travelled,
            "npcWinRate": self.npc_win_rate,
            "playerWinRate": self.player_win_rate,
            "drawRate": self.draw_rate,
        }


class TrialMetricsTracker:
    def __init__(
        self,
        experiment_id: str,
        trial_number: int,
        ai_type: str,
        ai_label: str,
        scenario_id: str,
        scenario_name: str,
        seed: int,
        time_limit_sec: float
    ):
        self.experiment_id = experiment_id
        self.trial_number = trial_number
        self.ai_type = ai_type
        self.ai_label = ai_label
        self.scenario_id = scenario_id
        self.scenario_name = scenario_name
        self.seed = seed
        self.time_limit_sec = float(time_limit_sec)

        self.survival_time = 0.0
        self.damage_dealt = 0.0
        self.damage_received = 0.0
        self.attacks = 0
        self.retreats = 0
        self.distance_travelled = 0.0

        self.final_npc_health = 100.0
        self.final_player_health = 100.0

        self._last_npc_pos: Optional[tuple[float, float]] = None
        self._is_currently_attacking = False
        self._is_currently_retreating = False
        self._attack_cooldown = 0.0

    def on_step(
        self,
        dt: float,
        npc_pos: tuple[float, float],
        npc_health: float,
        player_health: float,
        is_retreat_state: bool,
        is_melee_contact: bool
    ):
        self.survival_time += dt
        self.final_npc_health = max(0.0, round(npc_health, 1))
        self.final_player_health = max(0.0, round(player_health, 1))

        # Distance accumulation
        if self._last_npc_pos is not None:
            dx = npc_pos[0] - self._last_npc_pos[0]
            dy = npc_pos[1] - self._last_npc_pos[1]
            step_dist = math.hypot(dx, dy)
            if step_dist < 100.0:  # Filter resets/teleports
                self.distance_travelled += step_dist
        self._last_npc_pos = npc_pos

        # Attack engagements (debounced)
        if self._attack_cooldown > 0.0:
            self._attack_cooldown -= dt

        if is_melee_contact and not self._is_currently_attacking and self._attack_cooldown <= 0.0:
            self.attacks += 1
            self._is_currently_attacking = True
            self._attack_cooldown = 0.4
        elif not is_melee_contact:
            self._is_currently_attacking = False

        # Retreat transitions
        if is_retreat_state and not self._is_currently_retreating:
            self.retreats += 1
            self._is_currently_retreating = True
        elif not is_retreat_state:
            self._is_currently_retreating = False

    def record_damage_dealt(self, amount: float):
        self.damage_dealt += amount

    def record_damage_received(self, amount: float):
        self.damage_received += amount

    def finalize(self, timestamp: float = 0.0) -> TrialResult:
        npc_won = False
        player_won = False

        if self.final_player_health <= 0.0:
            outcome = "NPC Win"
            npc_won = True
        elif self.final_npc_health <= 0.0:
            outcome = "Player Win"
            player_won = True
        elif self.final_npc_health > self.final_player_health:
            outcome = "NPC Win"
            npc_won = True
        elif self.final_player_health > self.final_npc_health:
            outcome = "Player Win"
            player_won = True
        else:
            outcome = "Timeout (Draw)"

        return TrialResult(
            experiment_id=self.experiment_id,
            trial_number=self.trial_number,
            ai_type=self.ai_type,
            ai_label=self.ai_label,
            scenario_id=self.scenario_id,
            scenario_name=self.scenario_name,
            seed=self.seed,
            survival_time=round(self.survival_time, 2),
            damage_dealt=round(self.damage_dealt, 1),
            damage_received=round(self.damage_received, 1),
            npc_won=npc_won,
            player_won=player_won,
            attacks=self.attacks,
            retreats=self.retreats,
            distance_travelled=round(self.distance_travelled, 1),
            final_npc_health=self.final_npc_health,
            final_player_health=self.final_player_health,
            outcome=outcome,
            timestamp=timestamp,
        )


def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _std_dev(values: List[float], avg: float) -> float:
    if len(values) <= 1:
        return 0.0
    variance = sum((x - avg) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)


def compute_aggregates(ai_type: str, ai_label: str, trials: List[TrialResult]) -> AggregatedMetrics:
    count = len(trials)
    if count == 0:
        return AggregatedMetrics(
            ai_type=ai_type,
            ai_label=ai_label,
            trial_count=0,
            mean_survival_time=0.0,
            std_survival_time=0.0,
            min_survival_time=0.0,
            max_survival_time=0.0,
            mean_damage_dealt=0.0,
            std_damage_dealt=0.0,
            min_damage_dealt=0.0,
            max_damage_dealt=0.0,
            mean_damage_received=0.0,
            std_damage_received=0.0,
            mean_attacks=0.0,
            std_attacks=0.0,
            mean_retreats=0.0,
            std_retreats=0.0,
            mean_distance_travelled=0.0,
            std_distance_travelled=0.0,
            npc_win_rate=0.0,
            player_win_rate=0.0,
            draw_rate=0.0,
        )

    survivals = [t.survival_time for t in trials]
    dmg_dealt = [t.damage_dealt for t in trials]
    dmg_received = [t.damage_received for t in trials]
    attacks = [float(t.attacks) for t in trials]
    retreats = [float(t.retreats) for t in trials]
    distances = [t.distance_travelled for t in trials]

    avg_surv = _mean(survivals)
    avg_dealt = _mean(dmg_dealt)
    avg_received = _mean(dmg_received)
    avg_att = _mean(attacks)
    avg_ret = _mean(retreats)
    avg_dist = _mean(distances)

    npc_wins = sum(1 for t in trials if t.npc_won)
    player_wins = sum(1 for t in trials if t.player_won)
    draws = sum(1 for t in trials if not t.npc_won and not t.player_won)

    return AggregatedMetrics(
        ai_type=ai_type,
        ai_label=ai_label,
        trial_count=count,
        mean_survival_time=round(avg_surv, 2),
        std_survival_time=round(_std_dev(survivals, avg_surv), 2),
        min_survival_time=round(min(survivals), 2),
        max_survival_time=round(max(survivals), 2),
        mean_damage_dealt=round(avg_dealt, 1),
        std_damage_dealt=round(_std_dev(dmg_dealt, avg_dealt), 1),
        min_damage_dealt=round(min(dmg_dealt), 1),
        max_damage_dealt=round(max(dmg_dealt), 1),
        mean_damage_received=round(avg_received, 1),
        std_damage_received=round(_std_dev(dmg_received, avg_received), 1),
        mean_attacks=round(avg_att, 1),
        std_attacks=round(_std_dev(attacks, avg_att), 2),
        mean_retreats=round(avg_ret, 1),
        std_retreats=round(_std_dev(retreats, avg_ret), 2),
        mean_distance_travelled=round(avg_dist, 1),
        std_distance_travelled=round(_std_dev(distances, avg_dist), 1),
        npc_win_rate=round((npc_wins / count) * 100.0, 1),
        player_win_rate=round((player_wins / count) * 100.0, 1),
        draw_rate=round((draws / count) * 100.0, 1),
    )


def export_trials_to_csv(trials: List[TrialResult]) -> str:
    """Exports trial results to RFC 4180 CSV."""
    headers = [
        "experiment_id",
        "trial",
        "ai_system",
        "map",
        "seed",
        "survival_time",
        "damage_dealt",
        "damage_received",
        "npc_win",
        "player_win",
        "attacks",
        "retreats",
        "distance_travelled",
        "final_npc_health",
        "final_player_health",
        "outcome",
        "timestamp",
    ]

    rows = [
        [
            t.experiment_id,
            t.trial_number,
            t.ai_label,
            t.scenario_name,
            t.seed,
            t.survival_time,
            t.damage_dealt,
            t.damage_received,
            1 if t.npc_won else 0,
            1 if t.player_won else 0,
            t.attacks,
            t.retreats,
            t.distance_travelled,
            t.final_npc_health,
            t.final_player_health,
            f'"{t.outcome}"',
            t.timestamp,
        ]
        for t in trials
    ]

    lines = [",".join(headers)]
    for r in rows:
        lines.append(",".join(str(val) for val in r))
    return "\n".join(lines)


def export_aggregates_to_csv(aggregates: List[AggregatedMetrics]) -> str:
    """Exports aggregated statistics comparison table to RFC 4180 CSV."""
    headers = [
        "ai_system",
        "trial_count",
        "win_rate_percent",
        "draw_rate_percent",
        "mean_survival_time",
        "std_survival_time",
        "min_survival_time",
        "max_survival_time",
        "mean_damage_dealt",
        "std_damage_dealt",
        "min_damage_dealt",
        "max_damage_dealt",
        "mean_damage_received",
        "mean_attacks",
        "mean_retreats",
        "mean_distance_travelled",
    ]

    lines = [",".join(headers)]
    for a in aggregates:
        row = [
            a.ai_label,
            a.trial_count,
            a.npc_win_rate,
            a.draw_rate,
            a.mean_survival_time,
            a.std_survival_time,
            a.min_survival_time,
            a.max_survival_time,
            a.mean_damage_dealt,
            a.std_damage_dealt,
            a.min_damage_dealt,
            a.max_damage_dealt,
            a.mean_damage_received,
            a.mean_attacks,
            a.mean_retreats,
            a.mean_distance_travelled,
        ]
        lines.append(",".join(str(val) for val in row))
    return "\n".join(lines)
