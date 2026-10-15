"""
Hierarchical Behavior Tree Engine for Complex NPC Movement.
Includes real Selector, Sequence, Condition, and Action nodes with live
tick tracking and hierarchical status reporting for visual debugging.
Faithfully ported from TypeScript reference.
"""
from typing import List, Optional, Callable, Dict, Any
from simulation.vector2 import Vector2
from simulation.geometry import ray_intersect_aabb, has_line_of_sight
from simulation.entities import NPC, Player, HealingStation, Crate
from simulation.ai.base import BaseAI, AIOutput


class BTExecutionContext:
    def __init__(
        self,
        npc: NPC,
        player: Player,
        crates: List[Crate],
        heal_stations: List[HealingStation],
        nearest_heal_station: Optional[HealingStation]
    ):
        self.npc = npc
        self.player = player
        self.crates = crates
        self.heal_stations = heal_stations
        self.nearest_heal_station = nearest_heal_station

        # Outputs written by actions
        self.desired_velocity = Vector2(0.0, 0.0)
        self.steering_force = Vector2(0.0, 0.0)
        self.target_point = player.pos
        self.current_action_name = ""
        self.badge = "BT: Active"


class BTNode:
    def __init__(
        self,
        id: str,
        name: str,
        node_type: str,
        description: str,
        children: Optional[List["BTNode"]] = None
    ):
        self.id = id
        self.name = name
        self.node_type = node_type  # 'selector' | 'sequence' | 'action' | 'condition'
        self.description = description
        self.last_status: str = "INACTIVE"  # 'SUCCESS' | 'FAILURE' | 'RUNNING' | 'INACTIVE'
        self.children: List["BTNode"] = children or []

    def tick(self, context: BTExecutionContext, active_path: List[str]) -> str:
        raise NotImplementedError

    def get_snapshot(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.node_type,
            "status": self.last_status,
            "description": self.description,
            "children": [c.get_snapshot() for c in self.children],
        }

    def reset_status(self):
        self.last_status = "INACTIVE"
        for c in self.children:
            c.reset_status()


class SelectorNode(BTNode):
    def __init__(self, id: str, name: str, description: str, children: List[BTNode]):
        super().__init__(id, name, "selector", description, children)

    def tick(self, context: BTExecutionContext, active_path: List[str]) -> str:
        active_path.append(self.id)
        for child in self.children:
            status = child.tick(context, active_path)
            if status in ("RUNNING", "SUCCESS"):
                self.last_status = status
                return status
        self.last_status = "FAILURE"
        return "FAILURE"


class SequenceNode(BTNode):
    def __init__(self, id: str, name: str, description: str, children: List[BTNode]):
        super().__init__(id, name, "sequence", description, children)

    def tick(self, context: BTExecutionContext, active_path: List[str]) -> str:
        active_path.append(self.id)
        for child in self.children:
            status = child.tick(context, active_path)
            if status in ("FAILURE", "RUNNING"):
                self.last_status = status
                return status
        self.last_status = "SUCCESS"
        return "SUCCESS"


class ConditionNode(BTNode):
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        predicate: Callable[[BTExecutionContext], bool]
    ):
        super().__init__(id, name, "condition", description)
        self.predicate = predicate

    def tick(self, context: BTExecutionContext, active_path: List[str]) -> str:
        active_path.append(self.id)
        pass_test = self.predicate(context)
        self.last_status = "SUCCESS" if pass_test else "FAILURE"
        return self.last_status


class ActionNode(BTNode):
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        execute_fn: Callable[[BTExecutionContext], str]
    ):
        super().__init__(id, name, "action", description)
        self.execute_fn = execute_fn

    def tick(self, context: BTExecutionContext, active_path: List[str]) -> str:
        active_path.append(self.id)
        status = self.execute_fn(context)
        self.last_status = status
        return status


def create_complex_movement_behavior_tree() -> BTNode:
    """Factory for building the NPC Complex Movement Behavior Tree."""
    return SelectorNode(
        "root_selector",
        "Root Priority Selector",
        "Evaluate high-level goal: Survival vs Ambush vs Chase",
        [
            # Branch 1: Self-Preservation & Healing Sequence
            SequenceNode(
                "seq_heal",
                "Heal & Recover Sequence",
                "Seek healing station when health is critically low",
                [
                    ConditionNode(
                        "cond_health_low",
                        "Is Health < 35%?",
                        "Check if HP is below safety threshold or actively healing",
                        lambda ctx: (
                            (ctx.npc.is_healing and ctx.npc.health < ctx.npc.max_health * 0.8)
                            or (ctx.npc.health <= ctx.npc.max_health * 0.35)
                        ),
                    ),
                    ActionNode(
                        "act_navigate_heal",
                        "Navigate to Heal Station",
                        "Compute obstacle-avoiding steering towards healing zone",
                        _action_navigate_heal,
                    ),
                ],
            ),
            # Branch 2: Exhaustion & Stamina Recovery Sequence
            SequenceNode(
                "seq_exhaustion_recovery",
                "Fatigue Recovery Sequence",
                "Back off and catch breath when stamina is fully depleted",
                [
                    ConditionNode(
                        "cond_is_exhausted",
                        "Is Agent Exhausted?",
                        "Check if NPC has depleted aggression stamina",
                        lambda ctx: bool(ctx.npc.is_exhausted),
                    ),
                    ActionNode(
                        "act_catch_breath",
                        "Disengage & Catch Breath",
                        "Maintain standoff distance and slow down to catch breath",
                        _action_catch_breath,
                    ),
                ],
            ),
            # Branch 3: Tactical Obstacle Clearance & Corner Flank Sequence
            SequenceNode(
                "seq_tactical_cover",
                "Obstacle Cornering Sequence",
                "When player hides behind crate, steer around corner to flank",
                [
                    ConditionNode(
                        "cond_player_blocked",
                        "Player Behind Cover?",
                        "Check if direct line of sight to player is occluded by crate",
                        lambda ctx: not has_line_of_sight(ctx.npc.pos, ctx.player.pos, ctx.crates),
                    ),
                    ActionNode(
                        "act_corner_flank",
                        "Navigate Around Crate Corner",
                        "Find nearest clear corner of obstructing crate and path towards it",
                        _action_corner_flank,
                    ),
                ],
            ),
            # Branch 4: Multi-Whisker Predictive Pursuit Action
            ActionNode(
                "act_whisker_chase",
                "Predictive Whisker Chase",
                "Steer directly towards predicted player pos with 5-ray feeler avoidance",
                _action_whisker_chase,
            ),
        ],
    )


def _action_navigate_heal(ctx: BTExecutionContext) -> str:
    if not ctx.nearest_heal_station:
        return "FAILURE"

    heal_center = ctx.nearest_heal_station.center
    ctx.target_point = heal_center

    # Check if inside healing station
    if ctx.nearest_heal_station.contains_point(ctx.npc.pos, ctx.npc.half_size):
        ctx.current_action_name = "Rest & Regenerate in Heal Shrine"
        ctx.badge = "BT: Regenerating"
        desired = ctx.npc.vel * 0.1
        ctx.desired_velocity = desired
        ctx.steering_force = desired - ctx.npc.vel
        return "RUNNING"

    ctx.current_action_name = "Retreating to Heal Station"
    ctx.badge = "BT: Flee to Heal"

    to_heal = (heal_center - ctx.npc.pos).normalize()
    avoid_force = Vector2(0.0, 0.0)

    for sensor in ctx.npc.sensors:
        if sensor.is_blocked and sensor.hit_distance > 0:
            urgency = (1.0 - (sensor.hit_distance / sensor.length)) ** 1.8
            if sensor.normal:
                avoid_force += sensor.normal * (urgency * 2.2)
            else:
                sensor_heading = ctx.npc.rotation + sensor.angle_offset
                avoid_force -= Vector2.from_heading(sensor_heading) * (urgency * 1.8)

    combined_dir = to_heal
    if avoid_force.length() > 0.05:
        combined_dir = (combined_dir + avoid_force).normalize()

    desired_speed = ctx.npc.max_speed * 1.25
    ctx.desired_velocity = combined_dir * desired_speed
    ctx.steering_force = (ctx.desired_velocity - ctx.npc.vel).clamp_length(ctx.npc.max_force * 1.4)
    return "RUNNING"


def _action_catch_breath(ctx: BTExecutionContext) -> str:
    npc_pos = ctx.npc.pos
    player_pos = ctx.player.pos
    dist_to_player = npc_pos.distance(player_pos)

    ctx.current_action_name = "Catching Breath (Exhausted)"
    ctx.badge = f"BT: Tired ({round(ctx.npc.aggression_stamina)}s)"

    if dist_to_player < 180.0:
        move_dir = (npc_pos - player_pos).normalize()
    else:
        tangent = Vector2(-(player_pos.y - npc_pos.y), player_pos.x - npc_pos.x)
        move_dir = tangent.normalize()

    # Whisker obstacle avoidance
    avoid_force = Vector2(0.0, 0.0)
    for sensor in ctx.npc.sensors:
        if sensor.is_blocked and sensor.hit_distance > 0:
            urgency = (1.0 - (sensor.hit_distance / sensor.length)) ** 2
            if sensor.normal:
                avoid_force += sensor.normal * (urgency * 2.5)

    if avoid_force.length() > 0.05:
        move_dir = (move_dir + avoid_force).normalize()

    tired_speed = ctx.npc.max_speed * 0.55
    ctx.target_point = npc_pos + move_dir * 120.0
    ctx.desired_velocity = move_dir * tired_speed
    ctx.steering_force = (ctx.desired_velocity - ctx.npc.vel).clamp_length(ctx.npc.max_force * 0.7)
    return "RUNNING"


def _action_corner_flank(ctx: BTExecutionContext) -> str:
    npc_pos = ctx.npc.pos
    player_pos = ctx.player.pos

    to_player = player_pos - npc_pos
    dist = to_player.length()
    if dist < 1e-4:
        return "FAILURE"
    dir_to_player = to_player / dist

    obstructing_crate = None
    min_hit_dist = float("inf")
    for crate in ctx.crates:
        hit = ray_intersect_aabb(npc_pos, dir_to_player, dist, crate)
        if hit.hit and hit.distance < min_hit_dist:
            min_hit_dist = hit.distance
            obstructing_crate = crate

    if not obstructing_crate:
        return "FAILURE"

    margin = ctx.npc.size * 1.4
    corners = [
        Vector2(obstructing_crate.min_x - margin, obstructing_crate.min_y - margin),
        Vector2(obstructing_crate.max_x + margin, obstructing_crate.min_y - margin),
        Vector2(obstructing_crate.min_x - margin, obstructing_crate.max_y + margin),
        Vector2(obstructing_crate.max_x + margin, obstructing_crate.max_y + margin),
    ]

    best_corner = min(corners, key=lambda c: npc_pos.distance(c) + c.distance(player_pos))
    ctx.target_point = best_corner
    ctx.current_action_name = "Tactical Crate Corner Flank"
    ctx.badge = "BT: Flank Cover"

    to_corner = (best_corner - npc_pos).normalize()
    avoid_force = Vector2(0.0, 0.0)
    for s in ctx.npc.sensors:
        if s.is_blocked and s.hit_distance < 60.0 and s.normal:
            avoid_force += s.normal * 1.5

    move_dir = (to_corner + avoid_force).normalize()
    ctx.desired_velocity = move_dir * (ctx.npc.max_speed * 1.05)
    ctx.steering_force = (ctx.desired_velocity - ctx.npc.vel).clamp_length(ctx.npc.max_force * 1.2)
    return "RUNNING"


def _action_whisker_chase(ctx: BTExecutionContext) -> str:
    npc_pos = ctx.npc.pos
    player_pos = ctx.player.pos
    player_vel = ctx.player.vel

    dist = npc_pos.distance(player_pos)
    lead_time = min(0.8, dist / (ctx.npc.max_speed + 1.0))
    predicted_pos = player_pos + player_vel * (lead_time * 12.0)
    ctx.target_point = predicted_pos
    ctx.current_action_name = "Predictive Whisker Chase"
    ctx.badge = "BT: Whisker Chase"

    direct_target = (predicted_pos - npc_pos).normalize()
    whisker_avoid_force = Vector2(0.0, 0.0)
    urgent_hit = False

    for sensor in ctx.npc.sensors:
        if sensor.is_blocked and sensor.hit_distance > 0:
            ratio = sensor.hit_distance / sensor.length
            urgency = (1.0 - ratio) ** 2
            if ratio < 0.4:
                urgent_hit = True

            if sensor.normal:
                whisker_avoid_force += sensor.normal * (urgency * 2.8)
            else:
                angle = ctx.npc.rotation + sensor.angle_offset
                whisker_avoid_force -= Vector2.from_heading(angle) * (urgency * 2.2)

    final_heading = direct_target
    if whisker_avoid_force.length() > 0.05:
        final_heading = (direct_target + whisker_avoid_force).normalize()

    speed = ctx.npc.max_speed * 0.85 if urgent_hit else ctx.npc.max_speed * 1.1
    ctx.desired_velocity = final_heading * speed
    ctx.steering_force = (ctx.desired_velocity - ctx.npc.vel).clamp_length(ctx.npc.max_force * 1.3)
    return "RUNNING"


class BehaviorTreeEngine(BaseAI):
    """
    Behavior Tree AI Controller.
    Instantiates and manages the hierarchical behavior tree per NPC,
    exporting active execution paths and tree snapshots for debugging.
    """

    def __init__(self):
        self.trees: Dict[str, BTNode] = {}

    def get_or_create_tree(self, npc_id: str) -> BTNode:
        if npc_id not in self.trees:
            self.trees[npc_id] = create_complex_movement_behavior_tree()
        return self.trees[npc_id]

    def reset(self):
        self.trees.clear()

    def evaluate(
        self,
        npc: NPC,
        player: Player,
        crates: List[Crate],
        heal_stations: List[HealingStation],
        nearest_heal_station: Optional[HealingStation]
    ) -> AIOutput:
        tree = self.get_or_create_tree(npc.id)
        ctx = BTExecutionContext(npc, player, crates, heal_stations, nearest_heal_station)
        active_path: List[str] = []

        tree.tick(ctx, active_path)

        debug = {
            "rootSnapshot": tree.get_snapshot(),
            "activePath": active_path,
            "currentAction": ctx.current_action_name,
        }

        return AIOutput(
            desired_velocity=ctx.desired_velocity,
            steering_force=ctx.steering_force,
            target_point=ctx.target_point,
            badge=ctx.badge,
            debug=debug,
        )
