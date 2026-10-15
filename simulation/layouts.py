"""
Arena layout presets matching the reference project:
- tactical (central bunker, barriers, crates)
- pillars (2x3 symmetric pillar grid)
- corridors (horizontal corridors with choke gate)
- scattered (procedural scattered obstacles)
"""
from typing import List, Tuple
from simulation.geometry import AABB
from simulation.entities import Crate, HealingStation


def get_map_layout(
    preset: str = "tactical",
    width: float = 1000.0,
    height: float = 700.0
) -> Tuple[List[Crate], List[HealingStation]]:
    heal_stations: List[HealingStation] = [
        HealingStation(
            id="heal_alpha",
            label="Shrine Alpha (Heal Zone)",
            x=45.0,
            y=45.0,
            width=110.0,
            height=110.0,
            heal_rate_per_sec=25.0,
            color="#10b981",
        ),
        HealingStation(
            id="heal_beta",
            label="Shrine Beta (Heal Zone)",
            x=width - 155.0,
            y=height - 155.0,
            width=110.0,
            height=110.0,
            heal_rate_per_sec=25.0,
            color="#10b981",
        ),
    ]

    crates: List[Crate] = []

    if preset == "tactical":
        crates = [
            Crate(id="c1", x=width * 0.42, y=height * 0.38, width=width * 0.16, height=height * 0.24, label="Central Bunker"),
            Crate(id="c2", x=width * 0.22, y=height * 0.22, width=90.0, height=160.0, label="West Wall"),
            Crate(id="c3", x=width * 0.68, y=height * 0.52, width=90.0, height=160.0, label="East Wall"),
            Crate(id="c4", x=width * 0.52, y=height * 0.12, width=140.0, height=75.0, label="North Crate"),
            Crate(id="c5", x=width * 0.28, y=height * 0.74, width=150.0, height=75.0, label="South Crate"),
            Crate(id="c6", x=width * 0.82, y=height * 0.18, width=80.0, height=80.0, label="NE Block"),
            Crate(id="c7", x=width * 0.12, y=height * 0.65, width=80.0, height=80.0, label="SW Block"),
        ]
    elif preset == "pillars":
        crates = [
            Crate(id="p1", x=width * 0.28, y=height * 0.25, width=80.0, height=80.0, label="Pillar 1"),
            Crate(id="p2", x=width * 0.50 - 40.0, y=height * 0.25, width=80.0, height=80.0, label="Pillar 2"),
            Crate(id="p3", x=width * 0.72 - 80.0, y=height * 0.25, width=80.0, height=80.0, label="Pillar 3"),
            Crate(id="p4", x=width * 0.28, y=height * 0.65 - 40.0, width=80.0, height=80.0, label="Pillar 4"),
            Crate(id="p5", x=width * 0.50 - 40.0, y=height * 0.65 - 40.0, width=80.0, height=80.0, label="Pillar 5"),
            Crate(id="p6", x=width * 0.72 - 80.0, y=height * 0.65 - 40.0, width=80.0, height=80.0, label="Pillar 6"),
        ]
    elif preset == "corridors":
        crates = [
            Crate(id="cor1", x=width * 0.18, y=height * 0.32, width=width * 0.42, height=50.0, label="Corridor A"),
            Crate(id="cor2", x=width * 0.72, y=height * 0.32, width=width * 0.16, height=50.0, label="Corridor B"),
            Crate(id="cor3", x=width * 0.12, y=height * 0.64, width=width * 0.22, height=50.0, label="Corridor C"),
            Crate(id="cor4", x=width * 0.44, y=height * 0.64, width=width * 0.44, height=50.0, label="Corridor D"),
            Crate(id="cor5", x=width * 0.50 - 25.0, y=height * 0.12, width=50.0, height=100.0, label="Choke Gate"),
        ]
    else:  # scattered
        crates = [
            Crate(id="s1", x=width * 0.25, y=height * 0.2, width=70.0, height=110.0),
            Crate(id="s2", x=width * 0.45, y=height * 0.15, width=110.0, height=70.0),
            Crate(id="s3", x=width * 0.65, y=height * 0.25, width=80.0, height=80.0),
            Crate(id="s4", x=width * 0.2, y=height * 0.55, width=130.0, height=60.0),
            Crate(id="s5", x=width * 0.48, y=height * 0.45, width=90.0, height=90.0),
            Crate(id="s6", x=width * 0.72, y=height * 0.6, width=75.0, height=120.0),
            Crate(id="s7", x=width * 0.38, y=height * 0.72, width=100.0, height=65.0),
        ]

    return crates, heal_stations
