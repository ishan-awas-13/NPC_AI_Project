"""
Fuzzy Logic AI Steering Engine for NPCs.
Uses continuous triangular and trapezoidal membership functions (trapmf/trimf),
Mamdani-style rule-based inference, and weighted vector defuzzification.
Faithfully ported from TypeScript reference.
"""
import math
from typing import Optional, List, Dict, Any
from simulation.vector2 import Vector2
from simulation.entities import NPC, Player, HealingStation, Crate
from simulation.ai.base import BaseAI, AIOutput


def trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership function."""
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)


def trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal membership function."""
    if b <= x <= c:
        return 1.0
    if x <= a or x >= d:
        return 0.0
    if x < b:
        return (x - a) / (b - a) if b > a else 1.0
    return (d - x) / (d - c) if d > c else 1.0


class FuzzySteeringEngine(BaseAI):
    """
    Continuous Fuzzy Logic Controller:
    - Distance membership: Near (0-170px), Med (110-310px), Far (250px+)
    - Health membership: Low (0-45%), Med (30-75%), High (60-100%)
    - Obstacle danger: trapmf on closest sensor hit distance
    - 5 Evaluated Rules:
        Rule 1: IF Health Low -> RETREAT & HEAL
        Rule 2: IF Health Med AND Distance Near -> CAUTIOUS FLANK / ORBIT
        Rule 3: IF Health Med AND Distance Med/Far -> BALANCED CHASE
        Rule 4: IF Health High AND Distance Far -> AGGRESSIVE PURSUIT (lead target)
        Rule 5: IF Health High AND Distance Near -> RELENTLESS RAM
    - Defuzzification: centroid / weighted blending of component vectors.
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
        dist_to_player = npc_pos.distance(player_pos)
        health_percent = (npc.health / npc.max_health) * 100.0

        # 1. Calculate Membership Degrees
        dist_near = trapmf(dist_to_player, 0.0, 0.0, 90.0, 170.0)
        dist_med = trimf(dist_to_player, 110.0, 210.0, 310.0)
        dist_far = trapmf(dist_to_player, 250.0, 340.0, 9999.0, 9999.0)

        health_low = trapmf(health_percent, 0.0, 0.0, 25.0, 45.0)
        health_med = trimf(health_percent, 30.0, 55.0, 75.0)
        health_high = trapmf(health_percent, 60.0, 80.0, 100.0, 100.0)

        # Obstacle Danger from forward whiskers
        min_sensor_dist = 120.0
        for s in npc.sensors:
            if s.is_blocked and s.hit_distance < min_sensor_dist:
                min_sensor_dist = s.hit_distance
        obstacle_danger = trapmf(min_sensor_dist, 0.0, 0.0, 45.0, 110.0)

        # 2. Fuzzy Rule Inference
        w_retreat = health_low
        w_flank = min(health_med, dist_near)
        w_balanced_chase = min(health_med, max(dist_med, dist_far))
        w_aggressive_chase = min(health_high, dist_far)
        w_relentless = min(health_high, max(dist_near, dist_med))

        # Component vectors
        # A) Pursuit Vector (Direct or Lead Target)
        player_vel = player.vel
        look_ahead_time = min(1.2, dist_to_player / (npc.max_speed + 1.0))
        predicted_player_pos = player_pos + player_vel * (look_ahead_time * 15.0)
        dir_to_predicted = (predicted_player_pos - npc_pos).normalize()
        direct_chase_dir = (player_pos - npc_pos).normalize()
        if direct_chase_dir.length_sq() < 1e-4:
            direct_chase_dir = Vector2(1.0, 0.0)

        # B) Flank Vector (circle around player perpendicularly)
        to_player = player_pos - npc_pos
        perp_dir = Vector2(-to_player.y, to_player.x).normalize()
        radial_push = -0.5 if dist_to_player < 140.0 else 0.2
        flank_dir = (perp_dir + direct_chase_dir * radial_push).normalize()

        # C) Heal Vector
        heal_dir = -direct_chase_dir
        target_heal_point = player_pos
        if nearest_heal_station:
            target_heal_point = nearest_heal_station.center
            heal_dir = (target_heal_point - npc_pos).normalize()

        # D) Raycast Whisker Obstacle Repulsion
        obstacle_avoidance_force = Vector2(0.0, 0.0)
        for sensor in npc.sensors:
            if sensor.is_blocked and sensor.hit_distance > 0:
                repulsion_strength = math.pow(1.0 - (sensor.hit_distance / sensor.length), 2)
                if sensor.normal:
                    obstacle_avoidance_force += sensor.normal * (repulsion_strength * 2.5)
                else:
                    sensor_heading = npc.rotation + sensor.angle_offset
                    sensor_dir = Vector2.from_heading(sensor_heading)
                    obstacle_avoidance_force -= sensor_dir * (repulsion_strength * 2.0)

        # 3. Defuzzification (Weighted Centroid Blending)
        blended_dir = Vector2(0.0, 0.0)
        total_weight = 0.0

        if w_retreat > 0.01:
            blended_dir += heal_dir * (w_retreat * 1.6)
            total_weight += w_retreat * 1.6
        if w_flank > 0.01:
            blended_dir += flank_dir * (w_flank * 1.1)
            total_weight += w_flank * 1.1
        if w_balanced_chase > 0.01:
            blended_dir += direct_chase_dir * (w_balanced_chase * 1.0)
            total_weight += w_balanced_chase * 1.0
        if w_aggressive_chase > 0.01:
            blended_dir += dir_to_predicted * (w_aggressive_chase * 1.3)
            total_weight += w_aggressive_chase * 1.3
        if w_relentless > 0.01:
            blended_dir += direct_chase_dir * (w_relentless * 1.4)
            total_weight += w_relentless * 1.4

        if total_weight < 0.05:
            blended_dir = direct_chase_dir
        else:
            blended_dir = blended_dir / total_weight

        # Inject obstacle avoidance force
        if obstacle_avoidance_force.length() > 0.05:
            blended_dir = (blended_dir + obstacle_avoidance_force * (1.4 + obstacle_danger * 1.5)).normalize()
        else:
            blended_dir = blended_dir.normalize()

        # Speed multiplier calculation
        stamina_ratio = npc.aggression_stamina / npc.max_aggression_stamina
        sprint_boost = -0.2 if npc.is_exhausted else (w_aggressive_chase * 0.35 * stamina_ratio)
        base_speed_mult = 0.85 + sprint_boost + (w_retreat * 0.4) - (w_flank * 0.15)
        speed_multiplier = max(0.70, min(1.3, base_speed_mult))

        target_speed = npc.max_speed * speed_multiplier
        desired_velocity = blended_dir * target_speed
        current_velocity = npc.vel
        steering_force = (desired_velocity - current_velocity).clamp_length(npc.max_force * 1.3)

        target_point = target_heal_point if w_retreat > 0.4 else (predicted_player_pos if w_aggressive_chase > 0.4 else player_pos)

        # Primary goal badge
        primary_goal = "Balanced Chase"
        badge = "FUZZY: Chase"
        if w_retreat > 0.4:
            primary_goal = "Emergency Retreat (Flee to Heal)"
            badge = f"FUZZY: Flee ({round(w_retreat * 100)}%)"
        elif w_flank > 0.4:
            primary_goal = "Cautious Orbit / Flank"
            badge = f"FUZZY: Flank ({round(w_flank * 100)}%)"
        elif w_aggressive_chase > 0.4:
            primary_goal = "Predictive Intercept"
            badge = f"FUZZY: Intercept ({round(w_aggressive_chase * 100)}%)"
        elif w_relentless > 0.5:
            primary_goal = "Relentless Charge"
            badge = "FUZZY: Charge"

        activated_rules = [
            {"rule": "IF Health is Low", "weight": round(w_retreat, 2), "action": "Retreat to Heal Station"},
            {"rule": "IF Health Med & Dist Near", "weight": round(w_flank, 2), "action": "Orbit / Flank Player"},
            {"rule": "IF Health Med & Dist Far", "weight": round(w_balanced_chase, 2), "action": "Balanced Pursuit"},
            {"rule": "IF Health High & Dist Far", "weight": round(w_aggressive_chase, 2), "action": "Predictive Intercept"},
            {"rule": "IF Health High & Dist Near", "weight": round(w_relentless, 2), "action": "Direct Ramming"},
        ]

        steer_angle_deg = (math.atan2(blended_dir.y, blended_dir.x) * 180.0) / math.pi

        debug: Dict[str, Any] = {
            "distanceNear": round(dist_near, 2),
            "distanceMed": round(dist_med, 2),
            "distanceFar": round(dist_far, 2),
            "healthLow": round(health_low, 2),
            "healthMed": round(health_med, 2),
            "healthHigh": round(health_high, 2),
            "obstacleDanger": round(obstacle_danger, 2),
            "activatedRules": activated_rules,
            "defuzzifiedGoal": primary_goal,
            "speedMultiplier": round(speed_multiplier, 2),
            "steerAngleDeg": round(steer_angle_deg),
        }

        return AIOutput(
            desired_velocity=desired_velocity,
            steering_force=steering_force,
            target_point=target_point,
            badge=badge,
            debug=debug,
        )
