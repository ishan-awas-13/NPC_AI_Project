"""
Deterministic, controlled scenario configurations for AI comparison experiments.
Each scenario sets strictly reproducible entity positions, crate obstacles,
healing stations, starting health pools, and time limits.
"""
from typing import NamedTuple, List, Optional
from simulation.vector2 import Vector2
from simulation.entities import Crate, HealingStation


class ScenarioConfig(NamedTuple):
    id: str
    name: str
    description: str
    purpose: str
    crates: List[Crate]
    heal_stations: List[HealingStation]
    npc_start_pos: Vector2
    player_start_pos: Vector2
    npc_initial_health: float
    player_initial_health: float
    time_limit_sec: float


def get_experiment_scenario(
    scenario_id: str,
    width: float = 1000.0,
    height: float = 700.0
) -> ScenarioConfig:
    if scenario_id == "open_arena":
        return ScenarioConfig(
            id="open_arena",
            name="Scenario 1: Open Arena",
            description="Direct combat, open field pursuit, and unconstrained engagement aggression.",
            purpose="Measures pursuit speed, line-of-sight interception, and direct combat damage output without obstacle interference.",
            crates=[],
            heal_stations=[],
            npc_start_pos=Vector2(width * 0.2, height * 0.5),
            player_start_pos=Vector2(width * 0.8, height * 0.5),
            npc_initial_health=100.0,
            player_initial_health=100.0,
            time_limit_sec=30.0,
        )

    elif scenario_id == "obstacle_arena":
        crates = [
            Crate(id="p1", x=width * 0.28, y=height * 0.25, width=80.0, height=80.0, label="Pillar NW"),
            Crate(id="p2", x=width * 0.50 - 40.0, y=height * 0.25, width=80.0, height=80.0, label="Pillar N"),
            Crate(id="p3", x=width * 0.72 - 80.0, y=height * 0.25, width=80.0, height=80.0, label="Pillar NE"),
            Crate(id="p4", x=width * 0.28, y=height * 0.65 - 40.0, width=80.0, height=80.0, label="Pillar SW"),
            Crate(id="p5", x=width * 0.50 - 40.0, y=height * 0.65 - 40.0, width=80.0, height=80.0, label="Pillar S"),
            Crate(id="p6", x=width * 0.72 - 80.0, y=height * 0.65 - 40.0, width=80.0, height=80.0, label="Pillar SE"),
        ]
        return ScenarioConfig(
            id="obstacle_arena",
            name="Scenario 2: Obstacle Arena",
            description="Symmetrical pillar grid requiring continuous sensory raycast steering.",
            purpose="Tests whisker raycast obstacle avoidance, steering jitter vs fluidity, and navigation around static barriers.",
            crates=crates,
            heal_stations=[],
            npc_start_pos=Vector2(width * 0.15, height * 0.15),
            player_start_pos=Vector2(width * 0.85, height * 0.85),
            npc_initial_health=100.0,
            player_initial_health=100.0,
            time_limit_sec=35.0,
        )

    elif scenario_id == "corridors":
        crates = [
            Crate(id="cor1", x=width * 0.18, y=height * 0.32, width=width * 0.42, height=50.0, label="Corridor A"),
            Crate(id="cor2", x=width * 0.72, y=height * 0.32, width=width * 0.16, height=50.0, label="Corridor B"),
            Crate(id="cor3", x=width * 0.12, y=height * 0.64, width=width * 0.22, height=50.0, label="Corridor C"),
            Crate(id="cor4", x=width * 0.44, y=height * 0.64, width=width * 0.44, height=50.0, label="Corridor D"),
            Crate(id="cor5", x=width * 0.50 - 25.0, y=height * 0.12, width=50.0, height=100.0, label="Choke Gate"),
        ]
        return ScenarioConfig(
            id="corridors",
            name="Scenario 3: Corridors & Choke Points",
            description="Constrained corridors, tight choke passages, and narrow turns.",
            purpose="Evaluates spatial adaptation, cornering resilience, and positioning under tight geometric bounds.",
            crates=crates,
            heal_stations=[],
            npc_start_pos=Vector2(width * 0.15, height * 0.85),
            player_start_pos=Vector2(width * 0.85, height * 0.18),
            npc_initial_health=100.0,
            player_initial_health=100.0,
            time_limit_sec=40.0,
        )

    elif scenario_id == "low_health":
        crates = [
            Crate(id="c1", x=width * 0.42, y=height * 0.38, width=width * 0.16, height=height * 0.24, label="Center Bunker"),
            Crate(id="c2", x=width * 0.22, y=height * 0.22, width=90.0, height=160.0, label="West Wall"),
            Crate(id="c3", x=width * 0.68, y=height * 0.52, width=90.0, height=160.0, label="East Wall"),
        ]
        heal_stations = [
            HealingStation(
                id="heal_nw",
                label="Sanctuary NW",
                x=45.0,
                y=45.0,
                width=120.0,
                height=120.0,
                heal_rate_per_sec=30.0,
                color="#10b981",
            )
        ]
        return ScenarioConfig(
            id="low_health",
            name="Scenario 4: Low Health Survival Loop",
            description="Critical initial HP condition testing self-preservation and emergency retreat.",
            purpose="Benchmarks prioritization of health recovery vs direct combat under high threat pressure.",
            crates=crates,
            heal_stations=heal_stations,
            npc_start_pos=Vector2(width * 0.5, height * 0.78),
            player_start_pos=Vector2(width * 0.5, height * 0.48),
            npc_initial_health=28.0,
            player_initial_health=100.0,
            time_limit_sec=35.0,
        )

    else:  # dynamic_crossfire
        crates = [
            Crate(id="c1", x=width * 0.35, y=height * 0.28, width=70.0, height=140.0, label="Cover West"),
            Crate(id="c2", x=width * 0.65 - 70.0, y=height * 0.28, width=70.0, height=140.0, label="Cover East"),
            Crate(id="c3", x=width * 0.50 - 45.0, y=height * 0.62, width=90.0, height=75.0, label="Low Bunker"),
        ]
        heal_stations = [
            HealingStation(
                id="heal_se",
                label="Emergency Station SE",
                x=width - 150.0,
                y=height - 150.0,
                width=100.0,
                height=100.0,
                heal_rate_per_sec=25.0,
                color="#10b981",
            )
        ]
        return ScenarioConfig(
            id="dynamic_crossfire",
            name="Scenario 5: Dynamic Crossfire & Flanking",
            description="Dynamic combat with broken line-of-sight and corner cover engagement.",
            purpose="Tests corner ambushes, predictive interception, and tactical target tracking.",
            crates=crates,
            heal_stations=heal_stations,
            npc_start_pos=Vector2(width * 0.2, height * 0.3),
            player_start_pos=Vector2(width * 0.8, height * 0.7),
            npc_initial_health=80.0,
            player_initial_health=90.0,
            time_limit_sec=40.0,
        )
