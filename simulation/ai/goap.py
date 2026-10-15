"""
Goal-Oriented Action Planning (GOAP) AI Engine.
Formulates multi-step plans using world state atoms, prioritized goals,
an action pool with preconditions & effects, and an A* forward state-space search.
Faithfully ported from TypeScript reference.
"""
from typing import Dict, List, Optional, Any, Callable
from simulation.vector2 import Vector2
from simulation.geometry import has_line_of_sight
from simulation.entities import NPC, Player, HealingStation, Crate
from simulation.ai.base import BaseAI, AIOutput


GOAPWorldState = Dict[str, bool]


class GOAPActionDefinition:
    def __init__(
        self,
        name: str,
        preconditions: GOAPWorldState,
        effects: GOAPWorldState,
        get_cost_fn: Callable[[NPC, Player, Optional[HealingStation]], float],
        get_target_fn: Callable[[NPC, Player, List[Crate], Optional[HealingStation]], Vector2],
        is_complete_fn: Callable[[NPC, Player, Optional[HealingStation]], bool],
    ):
        self.name = name
        self.preconditions = preconditions
        self.effects = effects
        self.get_cost_fn = get_cost_fn
        self.get_target_fn = get_target_fn
        self.is_complete_fn = is_complete_fn

    def get_cost(self, npc: NPC, player: Player, nearest_heal: Optional[HealingStation]) -> float:
        return self.get_cost_fn(npc, player, nearest_heal)

    def get_target(
        self, npc: NPC, player: Player, crates: List[Crate], nearest_heal: Optional[HealingStation]
    ) -> Vector2:
        return self.get_target_fn(npc, player, crates, nearest_heal)

    def is_complete(self, npc: NPC, player: Player, nearest_heal: Optional[HealingStation]) -> bool:
        return self.is_complete_fn(npc, player, nearest_heal)


class GOAPGoal:
    def __init__(
        self,
        name: str,
        priority_fn: Callable[[NPC, GOAPWorldState], float],
        desired_state: GOAPWorldState,
    ):
        self.name = name
        self.priority_fn = priority_fn
        self.desired_state = desired_state

    def get_priority(self, npc: NPC, world_state: GOAPWorldState) -> float:
        return self.priority_fn(npc, world_state)


class PlanNode:
    def __init__(
        self,
        state: GOAPWorldState,
        action: Optional[GOAPActionDefinition] = None,
        parent: Optional["PlanNode"] = None,
        g_cost: float = 0.0,
        h_cost: float = 0.0,
    ):
        self.state = state
        self.action = action
        self.parent = parent
        self.g_cost = g_cost
        self.h_cost = h_cost
        self.f_cost = g_cost + h_cost


class GOAPPlanner:
    goals: List[GOAPGoal] = [
        GOAPGoal(
            name="Survive & Regenerate",
            priority_fn=lambda npc, ws: 95.0 if npc.health <= 35.0 else 0.0,
            desired_state={"isHealthy": True},
        ),
        GOAPGoal(
            name="Flank Obscured Player",
            priority_fn=lambda npc, ws: 70.0 if (not ws.get("hasLineOfSight") and npc.health > 35.0) else 0.0,
            desired_state={"hasLineOfSight": True, "inCombatRange": True},
        ),
        GOAPGoal(
            name="Strike Player",
            priority_fn=lambda npc, ws: 50.0 if npc.health > 35.0 else 10.0,
            desired_state={"inMeleeRange": True},
        ),
    ]

    actions: List[GOAPActionDefinition] = [
        GOAPActionDefinition(
            name="Navigate to Healing Shrine",
            preconditions={},
            effects={"atHealingStation": True},
            get_cost_fn=lambda npc, player, nearest_heal: (
                100.0 if not nearest_heal else max(1.0, npc.pos.distance(nearest_heal.center) / 120.0)
            ),
            get_target_fn=lambda npc, player, crates, nearest_heal: (
                Vector2(500.0, 350.0) if not nearest_heal else nearest_heal.center
            ),
            is_complete_fn=lambda npc, player, nearest_heal: (
                True if not nearest_heal else nearest_heal.contains_point(npc.pos, npc.half_size)
            ),
        ),
        GOAPActionDefinition(
            name="Regenerate HP in Shrine",
            preconditions={"atHealingStation": True},
            effects={"isHealthy": True, "isCriticallyInjured": False},
            get_cost_fn=lambda npc, player, nearest_heal: 1.0,
            get_target_fn=lambda npc, player, crates, nearest_heal: (
                Vector2(500.0, 350.0) if not nearest_heal else nearest_heal.center
            ),
            is_complete_fn=lambda npc, player, nearest_heal: npc.health >= 85.0,
        ),
        GOAPActionDefinition(
            name="Corner Flank Maneuver",
            preconditions={"hasLineOfSight": False},
            effects={"hasLineOfSight": True, "inCombatRange": True},
            get_cost_fn=lambda npc, player, nearest_heal: 2.0,
            get_target_fn=lambda npc, player, crates, nearest_heal: _get_flank_corner(npc, player, crates),
            is_complete_fn=lambda npc, player, nearest_heal: npc.pos.distance(player.pos) < 160.0,
        ),
        GOAPActionDefinition(
            name="Predictive Intercept Gap",
            preconditions={"hasLineOfSight": True},
            effects={"inCombatRange": True},
            get_cost_fn=lambda npc, player, nearest_heal: npc.pos.distance(player.pos) / 150.0,
            get_target_fn=lambda npc, player, crates, nearest_heal: (
                player.pos + player.vel * min(0.4, npc.pos.distance(player.pos) / 400.0)
            ),
            is_complete_fn=lambda npc, player, nearest_heal: npc.pos.distance(player.pos) <= 150.0,
        ),
        GOAPActionDefinition(
            name="Melee Pounce Attack",
            preconditions={"inCombatRange": True, "hasLineOfSight": True},
            effects={"inMeleeRange": True},
            get_cost_fn=lambda npc, player, nearest_heal: 1.0,
            get_target_fn=lambda npc, player, crates, nearest_heal: player.pos,
            is_complete_fn=lambda npc, player, nearest_heal: npc.pos.distance(player.pos) <= 40.0,
        ),
    ]

    @staticmethod
    def satisfies(current: GOAPWorldState, required: GOAPWorldState) -> bool:
        for k, v in required.items():
            if current.get(k) != v:
                return False
        return True

    @staticmethod
    def apply_effects(state: GOAPWorldState, effects: GOAPWorldState) -> GOAPWorldState:
        res = dict(state)
        res.update(effects)
        return res

    @classmethod
    def plan(
        cls,
        start_state: GOAPWorldState,
        goal_state: GOAPWorldState,
        npc: NPC,
        player: Player,
        nearest_heal: Optional[HealingStation],
    ) -> Optional[List[GOAPActionDefinition]]:
        """A* forward state-space planner."""
        open_set: List[PlanNode] = [
            PlanNode(state=dict(start_state), action=None, parent=None, g_cost=0.0, h_cost=0.0)
        ]
        visited: set[str] = set()

        def state_key(s: GOAPWorldState) -> str:
            return "|".join(f"{k}:{s[k]}" for k in sorted(s.keys()))

        while open_set:
            open_set.sort(key=lambda n: n.f_cost)
            current = open_set.pop(0)

            if cls.satisfies(current.state, goal_state):
                plan: List[GOAPActionDefinition] = []
                curr: Optional[PlanNode] = current
                while curr and curr.action:
                    plan.insert(0, curr.action)
                    curr = curr.parent
                return plan

            key = state_key(current.state)
            if key in visited:
                continue
            visited.add(key)

            for action in cls.actions:
                if cls.satisfies(current.state, action.preconditions):
                    next_state = cls.apply_effects(current.state, action.effects)
                    next_key = state_key(next_state)
                    if next_key in visited:
                        continue

                    g_cost = current.g_cost + action.get_cost(npc, player, nearest_heal)
                    h_cost = sum(1.0 for k, v in goal_state.items() if next_state.get(k) != v)
                    open_set.append(
                        PlanNode(
                            state=next_state,
                            action=action,
                            parent=current,
                            g_cost=g_cost,
                            h_cost=h_cost,
                        )
                    )

        return None

    @staticmethod
    def sense_world(
        npc: NPC,
        player: Player,
        crates: List[Crate],
        nearest_heal: Optional[HealingStation],
    ) -> GOAPWorldState:
        dist_to_player = npc.pos.distance(player.pos)
        has_los = has_line_of_sight(npc.pos, player.pos, crates)
        at_heal = bool(nearest_heal and nearest_heal.contains_point(npc.pos, npc.half_size))

        return {
            "playerAlive": player.health > 0.0,
            "inMeleeRange": dist_to_player <= 42.0,
            "inCombatRange": dist_to_player <= 160.0,
            "hasLineOfSight": has_los,
            "isCriticallyInjured": npc.health <= 35.0,
            "atHealingStation": at_heal,
            "isHealthy": npc.health >= 85.0,
        }


def _get_flank_corner(npc: NPC, player: Player, crates: List[Crate]) -> Vector2:
    blocking_crate = None
    for c in crates:
        if not has_line_of_sight(npc.pos, player.pos, [c]):
            blocking_crate = c
            break

    if not blocking_crate:
        return player.pos

    margin = 30.0
    corners = [
        Vector2(blocking_crate.min_x - margin, blocking_crate.min_y - margin),
        Vector2(blocking_crate.max_x + margin, blocking_crate.min_y - margin),
        Vector2(blocking_crate.min_x - margin, blocking_crate.max_y + margin),
        Vector2(blocking_crate.max_x + margin, blocking_crate.max_y + margin),
    ]

    return min(corners, key=lambda c: npc.pos.distance(c) + c.distance(player.pos))


class GOAPMemory:
    def __init__(self):
        self.current_plan: List[GOAPActionDefinition] = []
        self.current_goal_name: str = "Evaluating..."
        self.goal_priority: float = 0.0
        self.plan_index: int = 0
        self.replan_count: int = 0


class GOAPSteeringEngine(BaseAI):
    def __init__(self):
        self.memories: Dict[str, GOAPMemory] = {}

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
        mem = self.memories.setdefault(npc.id, GOAPMemory())
        world_state = GOAPPlanner.sense_world(npc, player, crates, nearest_heal_station)

        # Evaluate active goal
        sorted_goals = sorted(
            GOAPPlanner.goals,
            key=lambda g: g.get_priority(npc, world_state),
            reverse=True,
        )
        active_goal = sorted_goals[0]

        current_action = (
            mem.current_plan[mem.plan_index] if mem.plan_index < len(mem.current_plan) else None
        )
        should_replan = (
            not current_action
            or mem.current_goal_name != active_goal.name
            or current_action.is_complete(npc, player, nearest_heal_station)
        )

        if should_replan:
            if current_action and current_action.is_complete(npc, player, nearest_heal_station):
                mem.plan_index += 1

            if mem.plan_index >= len(mem.current_plan) or mem.current_goal_name != active_goal.name:
                new_plan = GOAPPlanner.plan(
                    world_state,
                    active_goal.desired_state,
                    npc,
                    player,
                    nearest_heal_station,
                )
                if new_plan:
                    mem.current_plan = new_plan
                    mem.plan_index = 0
                    mem.current_goal_name = active_goal.name
                    mem.goal_priority = active_goal.get_priority(npc, world_state)
                    mem.replan_count += 1
                else:
                    mem.current_goal_name = active_goal.name
                    mem.goal_priority = active_goal.get_priority(npc, world_state)

        executing_action = (
            mem.current_plan[mem.plan_index] if mem.plan_index < len(mem.current_plan) else None
        )
        target_pt = player.pos
        action_name = "Searching Plan..."

        if executing_action:
            action_name = executing_action.name
            target_pt = executing_action.get_target(npc, player, crates, nearest_heal_station)

        # Steering calculation towards target
        to_target = target_pt - npc.pos
        dist_to_target = to_target.length()
        desired_vel = Vector2(0.0, 0.0)

        if dist_to_target > 1.0:
            speed_mult = 1.15 if executing_action and "Melee" in executing_action.name else 1.0
            if npc.is_exhausted:
                speed_mult = 0.55
            desired_vel = to_target.normalize() * (npc.max_speed * speed_mult)

        # Whisker obstacle avoidance
        obstacle_repulsion = Vector2(0.0, 0.0)
        for sensor in npc.sensors:
            if sensor.is_blocked and sensor.normal:
                proximity = max(0.0, 1.0 - sensor.hit_distance / sensor.length)
                weight = proximity * proximity * 360.0
                obstacle_repulsion += sensor.normal * weight

        blended_desired = desired_vel + obstacle_repulsion
        steering_force = (blended_desired - npc.vel).clamp_length(npc.max_force)

        # Plan inspection details
        plan_info = [
            {
                "name": act.name,
                "cost": act.get_cost(npc, player, nearest_heal_station),
                "preconditions": act.preconditions,
                "effects": act.effects,
                "status": "completed" if idx < mem.plan_index else ("running" if idx == mem.plan_index else "pending"),
            }
            for idx, act in enumerate(mem.current_plan)
        ]

        total_cost = sum(act.get_cost(npc, player, nearest_heal_station) for act in mem.current_plan)

        badge = f"GOAP: {action_name}"
        if "Melee" in action_name:
            badge = "GOAP: Pounce"
        elif "Heal" in action_name or "Regenerate" in action_name:
            badge = "GOAP: Retreat to Heal"

        debug = {
            "currentGoal": active_goal.name,
            "goalPriority": active_goal.get_priority(npc, world_state),
            "worldState": world_state,
            "plan": plan_info,
            "currentActionIndex": mem.plan_index,
            "currentActionName": action_name,
            "totalPlanCost": total_cost,
            "replanCount": mem.replan_count,
        }

        return AIOutput(
            desired_velocity=desired_vel,
            steering_force=steering_force,
            target_point=target_pt,
            badge=badge,
            debug=debug,
        )
