"""
Geometry, collision detection, and raycasting functions.
Includes AABB bounding boxes, ray-AABB intersections, line-of-sight checks,
and solid box-circle non-penetration resolvers.
"""
import math
from typing import NamedTuple, Optional, List, Tuple
from simulation.vector2 import Vector2


class RayHit(NamedTuple):
    hit: bool
    distance: float
    point: Optional[Vector2] = None
    normal: Optional[Vector2] = None


class AABB:
    """Axis-Aligned Bounding Box (used for Crates and Healing Stations)."""
    __slots__ = ("x", "y", "width", "height", "id", "label", "color")

    def __init__(
        self,
        x: float,
        y: float,
        width: float,
        height: float,
        id: str = "",
        label: str = "",
        color: str = "#475569"
    ):
        self.x = float(x)
        self.y = float(y)
        self.width = float(width)
        self.height = float(height)
        self.id = id
        self.label = label
        self.color = color

    @property
    def min_x(self) -> float:
        return self.x

    @property
    def max_x(self) -> float:
        return self.x + self.width

    @property
    def min_y(self) -> float:
        return self.y

    @property
    def max_y(self) -> float:
        return self.y + self.height

    @property
    def center(self) -> Vector2:
        return Vector2(self.x + self.width * 0.5, self.y + self.height * 0.5)

    def contains_point(self, p: Vector2, padding: float = 0.0) -> bool:
        return (
            (self.min_x - padding) <= p.x <= (self.max_x + padding)
            and (self.min_y - padding) <= p.y <= (self.max_y + padding)
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "label": self.label,
            "color": self.color,
        }


def ray_intersect_aabb(
    origin: Vector2,
    direction: Vector2,
    max_dist: float,
    box: AABB
) -> RayHit:
    """
    Slab-method ray-AABB intersection test.
    Returns RayHit with hit=True, distance, hit point, and surface normal if hit within max_dist.
    """
    tmin = 0.0
    tmax = max_dist
    normal = Vector2(0.0, 0.0)

    min_x, max_x = box.min_x, box.max_x
    min_y, max_y = box.min_y, box.max_y

    # X-axis slab
    if abs(direction.x) < 1e-6:
        if origin.x < min_x or origin.x > max_x:
            return RayHit(hit=False, distance=max_dist)
    else:
        inv_d = 1.0 / direction.x
        t1 = (min_x - origin.x) * inv_d
        t2 = (max_x - origin.x) * inv_d
        n1 = Vector2(-1.0, 0.0)
        n2 = Vector2(1.0, 0.0)

        if t1 > t2:
            t1, t2 = t2, t1
            n1, n2 = n2, n1

        if t1 > tmin:
            tmin = t1
            normal = n1
        if t2 < tmax:
            tmax = t2
        if tmin > tmax:
            return RayHit(hit=False, distance=max_dist)

    # Y-axis slab
    if abs(direction.y) < 1e-6:
        if origin.y < min_y or origin.y > max_y:
            return RayHit(hit=False, distance=max_dist)
    else:
        inv_d = 1.0 / direction.y
        t1 = (min_y - origin.y) * inv_d
        t2 = (max_y - origin.y) * inv_d
        n1 = Vector2(0.0, -1.0)
        n2 = Vector2(0.0, 1.0)

        if t1 > t2:
            t1, t2 = t2, t1
            n1, n2 = n2, n1

        if t1 > tmin:
            tmin = t1
            normal = n1
        if t2 < tmax:
            tmax = t2
        if tmin > tmax:
            return RayHit(hit=False, distance=max_dist)

    if tmin < 0.0 or tmin > max_dist:
        return RayHit(hit=False, distance=max_dist)

    hit_point = Vector2(origin.x + direction.x * tmin, origin.y + direction.y * tmin)
    return RayHit(hit=True, distance=tmin, point=hit_point, normal=normal)


def resolve_box_collision(center: Vector2, half_size: float, box: AABB) -> Vector2:
    """
    Resolves overlap between a circular / square entity and an AABB crate.
    Pushes entity out along shortest penetration normal.
    """
    min_x, max_x = box.min_x, box.max_x
    min_y, max_y = box.min_y, box.max_y

    closest_x = max(min_x, min(max_x, center.x))
    closest_y = max(min_y, min(max_y, center.y))

    dist_x = center.x - closest_x
    dist_y = center.y - closest_y
    dist_sq = dist_x * dist_x + dist_y * dist_y

    if dist_sq < half_size * half_size:
        dist = math.sqrt(dist_sq)
        if dist < 1e-5:
            # Deep interior penetration: push out through nearest face
            dl = center.x - min_x
            dr = max_x - center.x
            dt = center.y - min_y
            db = max_y - center.y
            min_val = min(dl, dr, dt, db)
            if min_val == dl:
                return Vector2(min_x - half_size, center.y)
            elif min_val == dr:
                return Vector2(max_x + half_size, center.y)
            elif min_val == dt:
                return Vector2(center.x, min_y - half_size)
            else:
                return Vector2(center.x, max_y + half_size)

        nx = dist_x / dist
        ny = dist_y / dist
        push = half_size - dist
        return Vector2(center.x + nx * push, center.y + ny * push)

    return Vector2(center.x, center.y)


def has_line_of_sight(a: Vector2, b: Vector2, boxes: List[AABB]) -> bool:
    """
    Returns True if direct straight line between a and b is unblocked by boxes.
    """
    diff = b - a
    dist = diff.length()
    if dist < 1e-4:
        return True
    direction = diff.normalize()

    for box in boxes:
        hit = ray_intersect_aabb(a, direction, dist, box)
        if hit.hit and hit.distance < (dist - 2.0):
            return False
    return True
