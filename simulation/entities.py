"""
Simulation entities: Player, NPC, Crate, HealingStation, and RaySensor.
Defines entity physical state, sensors, stamina, health, and debug interfaces.
"""
import math
from typing import List, Optional, Dict, Any
from simulation.vector2 import Vector2
from simulation.geometry import AABB


class RaySensor:
    __slots__ = ("angle_offset", "length", "hit_distance", "is_blocked", "hit_point", "normal")

    def __init__(self, angle_offset: float, length: float):
        self.angle_offset = float(angle_offset)
        self.length = float(length)
        self.hit_distance = float(length)
        self.is_blocked = False
        self.hit_point: Optional[Vector2] = None
        self.normal: Optional[Vector2] = None

    def to_dict(self) -> dict:
        return {
            "angleOffset": self.angle_offset,
            "length": self.length,
            "hitDistance": round(self.hit_distance, 1),
            "isBlocked": self.is_blocked,
            "hitPoint": self.hit_point.to_dict() if self.hit_point else None,
            "normal": self.normal.to_dict() if self.normal else None,
        }


class Entity:
    def __init__(
        self,
        id: str,
        x: float,
        y: float,
        size: float = 24.0,
        health: float = 100.0,
        max_health: float = 100.0
    ):
        self.id = id
        self.pos = Vector2(x, y)
        self.vel = Vector2(0.0, 0.0)
        self.rotation = 0.0  # radians
        self.size = float(size)
        self.health = float(health)
        self.max_health = float(max_health)

    @property
    def x(self) -> float:
        return self.pos.x

    @x.setter
    def x(self, val: float):
        self.pos.x = float(val)

    @property
    def y(self) -> float:
        return self.pos.y

    @y.setter
    def y(self, val: float):
        self.pos.y = float(val)

    @property
    def vx(self) -> float:
        return self.vel.x

    @vx.setter
    def vx(self, val: float):
        self.vel.x = float(val)

    @property
    def vy(self) -> float:
        return self.vel.y

    @vy.setter
    def vy(self, val: float):
        self.vel.y = float(val)

    @property
    def half_size(self) -> float:
        return self.size * 0.5


class Player(Entity):
    def __init__(self, id: str = "player", x: float = 500.0, y: float = 350.0):
        super().__init__(id=id, x=x, y=y, size=26.0, health=100.0, max_health=100.0)
        self.max_speed = 230.0
        self.pulse_cooldown = 0.0
        self.max_pulse_cooldown = 3.5
        self.damage_flash = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "vx": round(self.vx, 2),
            "vy": round(self.vy, 2),
            "rotation": round(self.rotation, 3),
            "size": self.size,
            "health": round(self.health, 1),
            "maxHealth": self.max_health,
            "pulseCooldown": round(self.pulse_cooldown, 2),
            "damageFlash": round(self.damage_flash, 2),
        }


class NPC(Entity):
    def __init__(
        self,
        id: str,
        ai_type: str,
        x: float,
        y: float,
        name: str = "",
        color: str = "#06b6d4",
        accent_color: str = "#22d3ee"
    ):
        super().__init__(id=id, x=x, y=y, size=24.0, health=100.0, max_health=100.0)
        self.ai_type = ai_type
        self.name = name or f"{ai_type.capitalize()} AI"
        self.color = color
        self.accent_color = accent_color

        # Dynamic max speed per AI type matching reference project
        speed_map = {
            "behavior_tree": 185.0,
            "fuzzy": 190.0,
            "goap": 185.0,
            "utility": 188.0,
            "simple": 175.0,
        }
        self.max_speed = speed_map.get(ai_type, 180.0)
        self.max_force = 420.0

        # Health & healing status
        self.is_healing = False
        self.healing_timer = 0.0
        self.last_damage_time = 0.0

        # Aggression Stamina system (4.0 seconds sprint/chase buffer)
        self.aggression_stamina = 4.0
        self.max_aggression_stamina = 4.0
        self.is_exhausted = False

        # 5-feeler forward whisker raycast sensor array
        self.sensors: List[RaySensor] = [
            RaySensor(angle_offset=0.0, length=115.0),
            RaySensor(angle_offset=-0.42, length=95.0),
            RaySensor(angle_offset=0.42, length=95.0),
            RaySensor(angle_offset=-0.85, length=65.0),
            RaySensor(angle_offset=0.85, length=65.0),
        ]

        # Diagnostic state & vectors for HUD/Inspector
        self.debug_data: Dict[str, Any] = {
            "desiredVelocity": {"x": 0.0, "y": 0.0},
            "steeringForce": {"x": 0.0, "y": 0.0},
            "targetPoint": {"x": self.x, "y": self.y},
            "stateBadge": "Initializing...",
        }

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "aiType": self.ai_type,
            "name": self.name,
            "color": self.color,
            "accentColor": self.accent_color,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "vx": round(self.vx, 2),
            "vy": round(self.vy, 2),
            "rotation": round(self.rotation, 3),
            "size": self.size,
            "health": round(self.health, 1),
            "maxHealth": self.max_health,
            "maxSpeed": self.max_speed,
            "isHealing": self.is_healing,
            "aggressionStamina": round(self.aggression_stamina, 2),
            "maxAggressionStamina": self.max_aggression_stamina,
            "isExhausted": self.is_exhausted,
            "sensors": [s.to_dict() for s in self.sensors],
            "debugData": self.debug_data,
        }


class HealingStation(AABB):
    def __init__(
        self,
        id: str,
        label: str,
        x: float,
        y: float,
        width: float = 110.0,
        height: float = 110.0,
        heal_rate_per_sec: float = 25.0,
        color: str = "#10b981"
    ):
        super().__init__(x=x, y=y, width=width, height=height, id=id, label=label, color=color)
        self.heal_rate_per_sec = float(heal_rate_per_sec)

    def to_dict(self) -> dict:
        d = super().to_dict()
        d["healRatePerSec"] = self.heal_rate_per_sec
        return d


class Crate(AABB):
    pass
