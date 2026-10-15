"""
2D Vector mathematics module for continuous steering, raycasting, and physics.
Designed for deterministic calculations without external heavy dependencies.
"""
import math
from typing import NamedTuple, Tuple, Union


class Vector2:
    __slots__ = ("x", "y")

    def __init__(self, x: float = 0.0, y: float = 0.0):
        self.x = float(x)
        self.y = float(y)

    def __repr__(self) -> str:
        return f"Vector2({self.x:.3f}, {self.y:.3f})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Vector2):
            return False
        return math.isclose(self.x, other.x, abs_tol=1e-7) and math.isclose(self.y, other.y, abs_tol=1e-7)

    def __add__(self, other: "Vector2") -> "Vector2":
        return Vector2(self.x + other.x, self.y + other.y)

    def __sub__(self, other: "Vector2") -> "Vector2":
        return Vector2(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar: Union[float, int]) -> "Vector2":
        return Vector2(self.x * scalar, self.y * scalar)

    def __rmul__(self, scalar: Union[float, int]) -> "Vector2":
        return Vector2(self.x * scalar, self.y * scalar)

    def __truediv__(self, scalar: Union[float, int]) -> "Vector2":
        if scalar == 0:
            return Vector2(0.0, 0.0)
        return Vector2(self.x / scalar, self.y / scalar)

    def __neg__(self) -> "Vector2":
        return Vector2(-self.x, -self.y)

    def to_tuple(self) -> Tuple[float, float]:
        return (self.x, self.y)

    def to_dict(self) -> dict:
        return {"x": round(self.x, 2), "y": round(self.y, 2)}

    def length_sq(self) -> float:
        return self.x * self.x + self.y * self.y

    def length(self) -> float:
        return math.hypot(self.x, self.y)

    def distance_sq(self, other: "Vector2") -> float:
        dx = self.x - other.x
        dy = self.y - other.y
        return dx * dx + dy * dy

    def distance(self, other: "Vector2") -> float:
        return math.hypot(self.x - other.x, self.y - other.y)

    def normalize(self) -> "Vector2":
        l = math.hypot(self.x, self.y)
        if l < 1e-7:
            return Vector2(0.0, 0.0)
        return Vector2(self.x / l, self.y / l)

    def dot(self, other: "Vector2") -> float:
        return self.x * other.x + self.y * other.y

    def cross(self, other: "Vector2") -> float:
        return self.x * other.y - self.y * other.x

    def clamp_length(self, max_len: float) -> "Vector2":
        l = math.hypot(self.x, self.y)
        if l > max_len and l > 1e-7:
            scale = max_len / l
            return Vector2(self.x * scale, self.y * scale)
        return Vector2(self.x, self.y)

    def rotate(self, angle_rad: float) -> "Vector2":
        c = math.cos(angle_rad)
        s = math.sin(angle_rad)
        return Vector2(self.x * c - self.y * s, self.x * s + self.y * c)

    @classmethod
    def from_heading(cls, angle_rad: float) -> "Vector2":
        return cls(math.cos(angle_rad), math.sin(angle_rad))

    def heading(self) -> float:
        return math.atan2(self.y, self.x)

    def lerp(self, other: "Vector2", t: float) -> "Vector2":
        return Vector2(
            self.x + (other.x - self.x) * t,
            self.y + (other.y - self.y) * t
        )
