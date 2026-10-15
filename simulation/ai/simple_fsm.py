"""
Simple Decision Logic / Finite State Machine (FSM) AI Engine.
Uses rigid, rule-based if/elif branches for direct chasing, low-health retreat,
obstacle tangent sliding, and exhausted standoff.
Faithfully ported from TypeScript reference.
"""
import math
from typing import Optional, List
from simulation.vector2 import Vector2
from simulation.entities import NPC, Player, HealingStation, Crate
from simulation.ai.base import BaseAI, AIOutput


class SimpleDecisionEngine(BaseAI):
    """
    Evaluates rule-based if-else transitions:
    1. Critical health (<= 30%) or active healing (< 75%) -> FLEE_TO_HEAL
    2. Exhaustion (stamina depleted) -> EXHAUSTED_STANDOFF
    3. Normal -> DIRECT_CHASE
    4. Close obstacle detection (< 50px) on center whisker -> OBSTACLE_SLIDE
    """

    def evaluate(
        self,
        npc: NPC,
        player: Player,
        crates: List[Crate],
        heal_stations: List[HealingStation],
        nearest_heal_station: Optional[HealingStation]
    ) -> AIOutput:
        npc_pos = npc.pos
        player_pos = player.pos
        health_percent = (npc.health / npc.max_health) * 100.0

        current_state = "DIRECT_CHASE"
        reason = ""
        target_point = player_pos
        badge = "SIMPLE: Chase"

        # Hard Decision Rule 1: Health check
        if health_percent <= 30.0 or (npc.is_healing and health_percent < 75.0):
            current_state = "FLEE_TO_HEAL"
            reason = f"Health low ({round(health_percent)}% <= 30%), fleeing to heal station"
            badge = "SIMPLE: Flee (Low HP)"

            if nearest_heal_station:
                target_point = nearest_heal_station.center
        elif npc.is_exhausted:
            # Hard Decision Rule 2: Exhaustion check - disengage and catch breath
            current_state = "EXHAUSTED_STANDOFF"
            reason = f"Exhausted ({math.ceil(npc.aggression_stamina)}s). Backing off to catch breath."
            badge = f"SIMPLE: Tired ({math.ceil(npc.aggression_stamina)}s)"

            # Stand off 140px away from player
            away_dir = (npc_pos - player_pos).normalize()
            if away_dir.length_sq() < 1e-4:
                away_dir = Vector2(1.0, 0.0)
            target_point = npc_pos + away_dir * 140.0
        else:
            current_state = "DIRECT_CHASE"
            reason = f"Health normal ({round(health_percent)}% > 30%), direct pursuit to player"
            badge = "SIMPLE: Direct Chase"
            target_point = player_pos

        # Direct heading towards target
        to_target = target_point - npc_pos
        target_dir = to_target.normalize()
        if target_dir.length_sq() < 1e-4:
            target_dir = Vector2(1.0, 0.0)

        # Simple single-feeler obstacle collision reaction (naive wall slide)
        obstacle_detected = False
        center_sensor = None
        for s in npc.sensors:
            if abs(s.angle_offset) < 0.05:
                center_sensor = s
                break
        if not center_sensor and npc.sensors:
            center_sensor = npc.sensors[0]

        if center_sensor and center_sensor.is_blocked and center_sensor.hit_distance < 50.0:
            obstacle_detected = True
            current_state = "OBSTACLE_SLIDE"
            reason = f"Obstacle detected at {round(center_sensor.hit_distance)}px. Applying naive tangent slide."
            badge = "SIMPLE: Wall Slide"

            if center_sensor.normal:
                n = center_sensor.normal
                # Tangents are (-n.y, n.x) and (n.y, -n.x)
                t1 = Vector2(-n.y, n.x)
                t2 = Vector2(n.y, -n.x)
                chosen_tangent = t1 if target_dir.dot(t1) >= target_dir.dot(t2) else t2
                # Blend tangent with small normal push outward
                target_dir = (chosen_tangent + n * 0.4).normalize()
            else:
                target_dir = target_dir.rotate(math.pi / 2.0)

        # Direct velocity calculation
        speed = npc.max_speed * 0.95
        if current_state == "FLEE_TO_HEAL":
            speed = npc.max_speed * 1.15
        elif current_state == "EXHAUSTED_STANDOFF":
            speed = npc.max_speed * 0.55

        desired_velocity = target_dir * speed

        # Direct steering force
        current_velocity = npc.vel
        steering_force = (desired_velocity - current_velocity).clamp_length(npc.max_force * 1.1)

        debug = {
            "currentState": current_state,
            "reason": reason,
            "targetPoint": target_point.to_dict(),
            "obstacleDetected": obstacle_detected,
        }

        return AIOutput(
            desired_velocity=desired_velocity,
            steering_force=steering_force,
            target_point=target_point,
            badge=badge,
            debug=debug,
        )
