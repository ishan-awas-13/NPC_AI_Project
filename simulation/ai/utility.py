"""
Utility AI Control System:
Evaluates continuous mathematical response curves (Exponential, Logistic, Quadratic, Linear)
across competing considerations (Survival Need, Combat Opportunity, Tactical Positioning)
and selects the optimal action with inertia-damped hysteresis.
Faithfully ported from TypeScript reference.
"""
import math
from typing import Dict, List, Optional, Any, Callable
from simulation.vector2 import Vector2
from simulation.geometry import has_line_of_sight
from simulation.entities import NPC, Player, HealingStation, Crate
from simulation.ai.base import BaseAI, AIOutput


class UtilityAction:
    def __init__(
        self,
        name: str,
        description: str,
        curve_type: str,
        weight: float,
        eval_fn: Callable[[NPC, Player, List[Crate], Optional[HealingStation], bool, float], float],
        target_speed_fn: Callable[[NPC, Player, List[Crate], Optional[HealingStation]], tuple[Vector2, float]],
    ):
        self.name = name
        self.description = description
        self.curve_type = curve_type
        self.weight = weight
        self.eval_fn = eval_fn
        self.target_speed_fn = target_speed_fn

    def evaluate_utility(
        self,
        npc: NPC,
        player: Player,
        crates: List[Crate],
        nearest_heal: Optional[HealingStation],
        has_los: bool,
        dist_to_player: float,
    ) -> float:
        return self.eval_fn(npc, player, crates, nearest_heal, has_los, dist_to_player)

    def get_target_and_speed(
        self,
        npc: NPC,
        player: Player,
        crates: List[Crate],
        nearest_heal: Optional[HealingStation],
    ) -> tuple[Vector2, float]:
        return self.target_speed_fn(npc, player, crates, nearest_heal)


def _eval_emergency_heal(
    npc: NPC,
    player: Player,
    crates: List[Crate],
    nearest_heal: Optional[HealingStation],
    has_los: bool,
    dist: float,
) -> float:
    hp_ratio = max(0.0, npc.health / npc.max_health)
    # Exponential urgency curve: (1 - hp)^2.2
    health_urgency = math.pow(max(0.0, 1.0 - hp_ratio), 2.2)

    dist_factor = 0.9
    if nearest_heal:
        d = npc.pos.distance(nearest_heal.center)
        dist_factor = max(0.4, 1.0 - d / 800.0)

    if npc.is_healing and hp_ratio < 0.85:
        return 0.95

    return min(1.0, health_urgency * 1.4 * dist_factor)


def _target_emergency_heal(
    npc: NPC, player: Player, crates: List[Crate], nearest_heal: Optional[HealingStation]
) -> tuple[Vector2, float]:
    if not nearest_heal:
        return npc.pos, 0.0
    return nearest_heal.center, npc.max_speed * 1.1


def _eval_corner_flank(
    npc: NPC,
    player: Player,
    crates: List[Crate],
    nearest_heal: Optional[HealingStation],
    has_los: bool,
    dist_to_player: float,
) -> float:
    if has_los:
        return 0.05
    if npc.health <= 35.0:
        return 0.1

    # Logistic sigmoid curve on distance: 1 / (1 + e^(-6*(d_norm - 0.3)))
    normalized_dist = dist_to_player / 400.0
    sigmoid = 1.0 / (1.0 + math.exp(-6.0 * (normalized_dist - 0.3)))
    health_factor = npc.health / npc.max_health

    return min(1.0, 0.82 * sigmoid * health_factor)


def _target_corner_flank(
    npc: NPC, player: Player, crates: List[Crate], nearest_heal: Optional[HealingStation]
) -> tuple[Vector2, float]:
    blocking_crate = None
    for c in crates:
        if not has_line_of_sight(npc.pos, player.pos, [c]):
            blocking_crate = c
            break

    if not blocking_crate:
        return player.pos, npc.max_speed

    margin = 30.0
    corners = [
        Vector2(blocking_crate.min_x - margin, blocking_crate.min_y - margin),
        Vector2(blocking_crate.max_x + margin, blocking_crate.min_y - margin),
        Vector2(blocking_crate.min_x - margin, blocking_crate.max_y + margin),
        Vector2(blocking_crate.max_x + margin, blocking_crate.max_y + margin),
    ]

    best_corner = min(corners, key=lambda c: npc.pos.distance(c) + c.distance(player.pos))
    return best_corner, npc.max_speed * 1.05


def _eval_velocity_intercept(
    npc: NPC,
    player: Player,
    crates: List[Crate],
    nearest_heal: Optional[HealingStation],
    has_los: bool,
    dist_to_player: float,
) -> float:
    if not has_los:
        return 0.15
    if npc.health <= 35.0:
        return 0.1

    d_norm = max(0.0, min(1.0, dist_to_player / 350.0))
    player_speed = player.vel.length()
    motion_bonus = min(0.25, player_speed / 400.0)

    return min(0.95, (0.45 + 0.35 * d_norm + motion_bonus) * (npc.health / 100.0))


def _target_velocity_intercept(
    npc: NPC, player: Player, crates: List[Crate], nearest_heal: Optional[HealingStation]
) -> tuple[Vector2, float]:
    d = npc.pos.distance(player.pos)
    lead = min(0.4, d / 450.0)
    return player.pos + player.vel * lead, npc.max_speed


def _eval_melee_pounce(
    npc: NPC,
    player: Player,
    crates: List[Crate],
    nearest_heal: Optional[HealingStation],
    has_los: bool,
    dist_to_player: float,
) -> float:
    if not has_los or dist_to_player > 180.0:
        return 0.05
    if npc.health <= 35.0:
        return 0.05
    if npc.is_exhausted or (npc.aggression_stamina <= 0.2):
        return 0.02

    # Quadratic dropoff curve: (1 - d/180)^2
    proximity = max(0.0, 1.0 - (dist_to_player / 180.0))
    quad = proximity * proximity
    health_confidence = math.pow(npc.health / 100.0, 1.2)
    stamina_factor = max(0.2, npc.aggression_stamina / npc.max_aggression_stamina)

    return min(1.0, quad * 0.95 * health_confidence * stamina_factor)


def _target_melee_pounce(
    npc: NPC, player: Player, crates: List[Crate], nearest_heal: Optional[HealingStation]
) -> tuple[Vector2, float]:
    speed_mult = 0.75 if npc.is_exhausted else 1.15
    return player.pos, npc.max_speed * speed_mult


class UtilityMemory:
    def __init__(self):
        self.current_action: str = "High-Aggression Melee Pounce"
        self.inertia_timer: float = 0.0
        self.inertia_bonus: float = 0.12


class UtilityAIEngine(BaseAI):
    actions: List[UtilityAction] = [
        UtilityAction(
            name="Emergency Heal Station Retreat",
            description="Exponential curve driven by missing health and shrine proximity",
            curve_type="Exponential",
            weight=1.25,
            eval_fn=_eval_emergency_heal,
            target_speed_fn=_target_emergency_heal,
        ),
        UtilityAction(
            name="Tactical Corner Flank",
            description="Logistic sigmoid curve activated when crates break line-of-sight",
            curve_type="Logistic (Sigmoid)",
            weight=1.0,
            eval_fn=_eval_corner_flank,
            target_speed_fn=_target_corner_flank,
        ),
        UtilityAction(
            name="Predictive Velocity Intercept",
            description="Linear response curve for medium/long distance target pursuit",
            curve_type="Linear",
            weight=1.0,
            eval_fn=_eval_velocity_intercept,
            target_speed_fn=_target_velocity_intercept,
        ),
        UtilityAction(
            name="High-Aggression Melee Pounce",
            description="Quadratic proximity curve when player is within striking distance",
            curve_type="Quadratic",
            weight=1.15,
            eval_fn=_eval_melee_pounce,
            target_speed_fn=_target_melee_pounce,
        ),
    ]

    def __init__(self):
        self.memories: Dict[str, UtilityMemory] = {}

    def reset(self):
        self.memories.clear()

    def evaluate(
        self,
        npc: NPC,
        player: Player,
        crates: List[Crate],
        heal_stations: List[HealingStation],
        nearest_heal_station: Optional[HealingStation],
    ) -> AIOutput:
        mem = self.memories.setdefault(npc.id, UtilityMemory())
        dist_to_player = npc.pos.distance(player.pos)
        has_los = has_line_of_sight(npc.pos, player.pos, crates)

        score_infos = []
        for act in self.actions:
            raw_score = act.evaluate_utility(
                npc, player, crates, nearest_heal_station, has_los, dist_to_player
            )
            weighted_score = raw_score * act.weight

            # Apply inertia hysteresis to previously active action to prevent 1-frame jitter
            is_current = act.name == mem.current_action
            final_score = min(1.0, weighted_score + (mem.inertia_bonus if is_current else 0.0))

            score_infos.append(
                {
                    "actionName": act.name,
                    "score": round(final_score, 2),
                    "curveType": act.curve_type,
                    "weight": act.weight,
                    "isActive": False,
                    "description": act.description,
                }
            )

        # Pick winning action
        score_infos.sort(key=lambda s: s["score"], reverse=True)
        winner = score_infos[0]
        winner["isActive"] = True
        mem.current_action = winner["actionName"]

        winning_action = next(a for a in self.actions if a.name == winner["actionName"])
        target, speed = winning_action.get_target_and_speed(npc, player, crates, nearest_heal_station)

        # Desired velocity
        to_target = target - npc.pos
        dist_target = to_target.length()
        desired_vel = Vector2(0.0, 0.0)
        if dist_target > 2.0:
            desired_vel = to_target.normalize() * speed

        # Whisker obstacle avoidance
        obstacle_repulsion = Vector2(0.0, 0.0)
        for sensor in npc.sensors:
            if sensor.is_blocked and sensor.normal:
                proximity = max(0.0, 1.0 - (sensor.hit_distance / sensor.length))
                weight = proximity * proximity * 340.0
                obstacle_repulsion += sensor.normal * weight

        blended_desired = desired_vel + obstacle_repulsion
        steering_force = (blended_desired - npc.vel).clamp_length(npc.max_force)

        badge = f"UTILITY: {winner['actionName']}"
        if "Heal" in winner["actionName"]:
            badge = "UTILITY: Flee to Heal"
        elif "Pounce" in winner["actionName"]:
            badge = "UTILITY: Pounce"
        elif "Flank" in winner["actionName"]:
            badge = "UTILITY: Flank Cover"
        elif "Intercept" in winner["actionName"]:
            badge = "UTILITY: Intercept"

        debug = {
            "scores": score_infos,
            "selectedAction": winner["actionName"],
            "highestUtility": winner["score"],
            "inertiaTimer": mem.inertia_timer,
        }

        return AIOutput(
            desired_velocity=desired_vel,
            steering_force=steering_force,
            target_point=target,
            badge=badge,
            debug=debug,
        )
