"""
Base AI Interface for the 5 continuous steering decision architectures.
Matches the architectural principle of mechanisms/base.py while providing
continuous steering forces and rich diagnostic payloads for visualization.
"""
from abc import ABC, abstractmethod
from typing import NamedTuple, Dict, Any, Optional
from simulation.vector2 import Vector2
from simulation.entities import NPC, Player, HealingStation, Crate


class AIOutput(NamedTuple):
    desired_velocity: Vector2
    steering_force: Vector2
    target_point: Vector2
    badge: str
    debug: Dict[str, Any]


class BaseAI(ABC):
    """
    Abstract Base Class for all 5 AI decision engines.
    Every engine receives the identical snapshot of world context:
    (npc, player, crates, heal_stations, nearest_heal_station).
    """

    @abstractmethod
    def evaluate(
        self,
        npc: NPC,
        player: Player,
        crates: list[Crate],
        heal_stations: list[HealingStation],
        nearest_heal_station: Optional[HealingStation]
    ) -> AIOutput:
        raise NotImplementedError

    def reset(self):
        """Reset internal memories / states between runs if needed."""
        pass
