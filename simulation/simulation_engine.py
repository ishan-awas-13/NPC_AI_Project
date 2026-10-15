"""
Core Simulation Engine for the 2D Continuous AI Benchmark Arena.
Manages entities, time stepping, player input, raycasting sensor updates,
anti-stacking flocking, crate collision resolution, stamina drain/recovery,
health recovery stations, and deterministic melee combat.

Completely independent of UI, browser, and network layers.
"""
import math
from typing import List, Optional, Dict, Any, Callable
from simulation.vector2 import Vector2
from simulation.geometry import AABB, ray_intersect_aabb, resolve_box_collision
from simulation.entities import Player, NPC, Crate, HealingStation, RaySensor
from simulation.layouts import get_map_layout
from simulation.scenarios import get_experiment_scenario, ScenarioConfig


class SimulationEngine:
    def __init__(self, width: float = 1000.0, height: float = 700.0):
        self.width = float(width)
        self.height = float(height)

        self.player = Player(id="player", x=self.width * 0.5, y=self.height * 0.5)
        self.npcs: List[NPC] = []
        self.crates: List[Crate] = []
        self.heal_stations: List[HealingStation] = []

        self.survival_time = 0.0
        self.tick_count = 0
        self.is_paused = False
        self.is_game_over = False
        self.current_preset = "tactical"

        # AI Controller callback dictionary mapping npc.id -> Callable(npc, player, engine) -> (desired_vel, steer_force, target_pt, badge, debug)
        self.ai_controllers: Dict[str, Callable] = {}

        self.load_preset("tactical")

    def load_preset(self, preset: str):
        self.current_preset = preset
        self.crates, self.heal_stations = get_map_layout(preset, self.width, self.height)

    def load_scenario(self, scenario_id: str) -> ScenarioConfig:
        config = get_experiment_scenario(scenario_id, self.width, self.height)
        self.crates = list(config.crates)
        self.heal_stations = list(config.heal_stations)
        self.player.x = config.player_start_pos.x
        self.player.y = config.player_start_pos.y
        self.player.vx = 0.0
        self.player.vy = 0.0
        self.player.health = config.player_initial_health
        self.survival_time = 0.0
        self.tick_count = 0
        self.is_game_over = False
        return config

    def register_npc(self, npc: NPC, controller: Optional[Callable] = None):
        self.npcs.append(npc)
        if controller:
            self.ai_controllers[npc.id] = controller

    def get_nearest_heal_station(self, pos: Vector2) -> Optional[HealingStation]:
        if not self.heal_stations:
            return None
        return min(
            self.heal_stations,
            key=lambda hs: pos.distance_sq(hs.center)
        )

    def update_sensors(self, npc: NPC):
        """
        Updates 5-feeler forward whisker ray sensors against crates and outer arena boundaries.
        Sensors cast out relative to the NPC's forward heading.
        """
        origin = npc.pos

        for sensor in npc.sensors:
            heading = npc.rotation + sensor.angle_offset
            direction = Vector2.from_heading(heading)

            closest_hit_dist = sensor.length
            hit_point: Optional[Vector2] = None
            hit_normal: Optional[Vector2] = None
            is_blocked = False

            # 1. Raycast against crates
            for crate in self.crates:
                hit = ray_intersect_aabb(origin, direction, sensor.length, crate)
                if hit.hit and hit.distance < closest_hit_dist:
                    closest_hit_dist = hit.distance
                    hit_point = hit.point
                    hit_normal = hit.normal
                    is_blocked = True

            # 2. Raycast against outer boundary walls
            # Left wall (x = 0)
            if direction.x < 0:
                t = -origin.x / direction.x
                if 0 <= t < closest_hit_dist:
                    closest_hit_dist = t
                    hit_point = Vector2(0.0, origin.y + direction.y * t)
                    hit_normal = Vector2(1.0, 0.0)
                    is_blocked = True

            # Right wall (x = width)
            if direction.x > 0:
                t = (self.width - origin.x) / direction.x
                if 0 <= t < closest_hit_dist:
                    closest_hit_dist = t
                    hit_point = Vector2(self.width, origin.y + direction.y * t)
                    hit_normal = Vector2(-1.0, 0.0)
                    is_blocked = True

            # Top wall (y = 0)
            if direction.y < 0:
                t = -origin.y / direction.y
                if 0 <= t < closest_hit_dist:
                    closest_hit_dist = t
                    hit_point = Vector2(origin.x + direction.x * t, 0.0)
                    hit_normal = Vector2(0.0, 1.0)
                    is_blocked = True

            # Bottom wall (y = height)
            if direction.y > 0:
                t = (self.height - origin.y) / direction.y
                if 0 <= t < closest_hit_dist:
                    closest_hit_dist = t
                    hit_point = Vector2(origin.x + direction.x * t, self.height)
                    hit_normal = Vector2(0.0, -1.0)
                    is_blocked = True

            sensor.hit_distance = closest_hit_dist
            sensor.hit_point = hit_point
            sensor.normal = hit_normal
            sensor.is_blocked = is_blocked

    def step_player(self, dt: float, move_x: float = 0.0, move_y: float = 0.0):
        """
        Updates player movement physics, friction, speed clamping, and obstacle collisions.
        """
        accel = 750.0
        friction = 5.2

        if move_x != 0.0 or move_y != 0.0:
            input_dir = Vector2(move_x, move_y).normalize()
            self.player.vx += input_dir.x * accel * dt
            self.player.vy += input_dir.y * accel * dt

        # Apply friction
        self.player.vx -= self.player.vx * friction * dt
        self.player.vy -= self.player.vy * friction * dt

        # Clamp speed
        current_speed = self.player.vel.length()
        if current_speed > self.player.max_speed:
            self.player.vel = self.player.vel.clamp_length(self.player.max_speed)

        # Update position
        self.player.x += self.player.vx * dt
        self.player.y += self.player.vy * dt

        if current_speed > 10.0:
            self.player.rotation = math.atan2(self.player.vy, self.player.vx)

        # Crate collisions
        p_half = self.player.half_size
        for crate in self.crates:
            self.player.pos = resolve_box_collision(self.player.pos, p_half, crate)

        # Arena bounds clamping
        self.player.x = max(p_half, min(self.width - p_half, self.player.x))
        self.player.y = max(p_half, min(self.height - p_half, self.player.y))

        # Cooldown decays
        if self.player.pulse_cooldown > 0.0:
            self.player.pulse_cooldown = max(0.0, self.player.pulse_cooldown - dt)
        if self.player.damage_flash > 0.0:
            self.player.damage_flash = max(0.0, self.player.damage_flash - dt)

    def step_npcs(self, dt: float):
        """
        Executes sensory update, AI evaluation (if registered), anti-stacking separation forces,
        stamina dynamics, velocity integration, crate collision resolution, healing stations, and melee combat.
        """
        player_pos = self.player.pos

        for npc in self.npcs:
            if npc.health <= 0.0:
                continue

            # 1. Update Ray Sensors
            self.update_sensors(npc)

            # 2. AI Decision Execution
            desired_vel = Vector2(0.0, 0.0)
            steer_force = Vector2(0.0, 0.0)
            target_pt = player_pos
            badge = "Active"

            if npc.id in self.ai_controllers:
                ai_handler = self.ai_controllers[npc.id]
                nearest_heal = self.get_nearest_heal_station(npc.pos)
                if hasattr(ai_handler, "evaluate"):
                    out = ai_handler.evaluate(npc, self.player, self.crates, self.heal_stations, nearest_heal)
                    desired_vel = out.desired_velocity
                    steer_force = out.steering_force
                    target_pt = out.target_point
                    badge = out.badge
                    if out.debug:
                        npc.debug_data[npc.ai_type] = out.debug
                elif callable(ai_handler):
                    res = ai_handler(npc, self.player, self)
                    if isinstance(res, dict):
                        desired_vel = res.get("desired_velocity", desired_vel)
                        steer_force = res.get("steering_force", steer_force)
                        target_pt = res.get("target_point", target_pt)
                        badge = res.get("badge", badge)
                        if "debug" in res:
                            npc.debug_data[npc.ai_type] = res["debug"]
                    elif isinstance(res, tuple):
                        desired_vel, steer_force, target_pt, badge = res[:4]
                        if len(res) > 4 and res[4]:
                            npc.debug_data[npc.ai_type] = res[4]

            # 3. Flocking Anti-Stacking Separation Forces
            # Proactively repels NPCs from each other to prevent clustering or conga lines
            separation_radius = 52.0
            for other in self.npcs:
                if other.id == npc.id or other.health <= 0.0:
                    continue
                diff = npc.pos - other.pos
                dist_sq = diff.length_sq()
                if dist_sq < 0.01:
                    diff = Vector2(1.0, 0.0)
                    dist_sq = 1.0
                if dist_sq < separation_radius * separation_radius:
                    dist = math.sqrt(dist_sq)
                    falloff = 1.0 - (dist / separation_radius)
                    force_mag = falloff * falloff * 320.0
                    steer_force += (diff / dist) * force_mag

            # 4. Aggression Stamina System
            # Sprinting and high-aggression pursuit drain stamina over ~4.0 seconds.
            # At zero stamina, entity becomes exhausted and drops to 55% speed.
            dist_to_player = npc.pos.distance(player_pos)
            is_aggressive = (
                "Pounce" in badge
                or "Charge" in badge
                or "Intercept" in badge
                or ("Chase" in badge and dist_to_player < 260.0)
                or ("Flank" in badge and dist_to_player < 200.0)
            )

            if is_aggressive and not npc.is_exhausted:
                npc.aggression_stamina = max(0.0, npc.aggression_stamina - dt)
                if npc.aggression_stamina <= 0.0:
                    npc.is_exhausted = True
            else:
                regen_rate = 0.8 if npc.is_exhausted else 1.2
                npc.aggression_stamina = min(
                    npc.max_aggression_stamina,
                    npc.aggression_stamina + dt * regen_rate
                )
                if npc.is_exhausted and npc.aggression_stamina >= (npc.max_aggression_stamina * 0.5):
                    npc.is_exhausted = False

            if npc.is_exhausted and "Tired" not in badge:
                badge = f"⚡ Tired ({math.ceil(npc.aggression_stamina)}s)"

            npc.debug_data["desiredVelocity"] = desired_vel.to_dict()
            npc.debug_data["steeringForce"] = steer_force.to_dict()
            npc.debug_data["targetPoint"] = target_pt.to_dict()
            npc.debug_data["stateBadge"] = badge

            # 5. Physics Integration
            npc.vx += steer_force.x * dt
            npc.vy += steer_force.y * dt

            current_max_speed = npc.max_speed * 0.55 if npc.is_exhausted else npc.max_speed * 1.12
            speed = npc.vel.length()
            if speed > current_max_speed:
                npc.vel = npc.vel.clamp_length(current_max_speed)

            # Damping
            npc.vx *= 0.985
            npc.vy *= 0.985

            npc.x += npc.vx * dt
            npc.y += npc.vy * dt

            if speed > 8.0:
                target_rot = math.atan2(npc.vy, npc.vx)
                angle_diff = target_rot - npc.rotation
                while angle_diff > math.pi:
                    angle_diff -= math.pi * 2
                while angle_diff < -math.pi:
                    angle_diff += math.pi * 2
                npc.rotation += angle_diff * min(1.0, 10.0 * dt)

            # 6. Obstacle Crate Collisions
            half_size = npc.half_size
            for crate in self.crates:
                npc.pos = resolve_box_collision(npc.pos, half_size, crate)

            npc.x = max(half_size, min(self.width - half_size, npc.x))
            npc.y = max(half_size, min(self.height - half_size, npc.y))

            # 7. Healing Stations
            inside_shrine = False
            for hs in self.heal_stations:
                if hs.contains_point(npc.pos, half_size):
                    inside_shrine = True
                    if npc.health < npc.max_health:
                        gain = hs.heal_rate_per_sec * dt
                        npc.health = min(npc.max_health, npc.health + gain)
                        npc.is_healing = True
                    break

            if inside_shrine and npc.health >= npc.max_health * 0.95:
                npc.is_healing = False
            elif not inside_shrine and npc.health >= npc.max_health * 0.75:
                npc.is_healing = False

            # 8. NPC vs Player Melee Combat
            p_dist = npc.pos.distance(player_pos)
            min_combat_dist = (npc.size + self.player.size) * 0.5
            if p_dist < min_combat_dist:
                damage_per_sec = 22.0
                dmg = damage_per_sec * dt
                self.player.health = max(0.0, self.player.health - dmg)
                self.player.damage_flash = 0.2

                # Push away slightly
                push_dir = (self.player.pos - npc.pos).normalize()
                self.player.x += push_dir.x * 25.0 * dt
                self.player.y += push_dir.y * 25.0 * dt

                if self.player.health <= 0.0:
                    self.is_game_over = True

        # 9. Multi-Agent Rigid Body Non-Penetration Resolution (2 relaxation passes)
        for _ in range(2):
            # A. NPC vs NPC Solid Non-Penetration
            for i in range(len(self.npcs)):
                for j in range(i + 1, len(self.npcs)):
                    a = self.npcs[i]
                    b = self.npcs[j]
                    if a.health <= 0.0 or b.health <= 0.0:
                        continue

                    diff = b.pos - a.pos
                    dist_sq = diff.length_sq()
                    min_dist = (a.size + b.size) * 0.58

                    if dist_sq < 0.01:
                        diff = Vector2(1.0, 0.0)
                        dist_sq = 1.0

                    if dist_sq < min_dist * min_dist:
                        dist = math.sqrt(dist_sq)
                        overlap = min_dist - dist
                        normal = diff / dist

                        a.x -= normal.x * overlap * 0.5
                        a.y -= normal.y * overlap * 0.5
                        b.x += normal.x * overlap * 0.5
                        b.y += normal.y * overlap * 0.5

                        # Separation damping impulse
                        rel_v = b.vel - a.vel
                        normal_vel = rel_v.dot(normal)
                        if normal_vel < 0.0:
                            restitution = 0.15
                            impulse = -(1.0 + restitution) * normal_vel * 0.4
                            a.vx -= normal.x * impulse
                            a.vy -= normal.y * impulse
                            b.vx += normal.x * impulse
                            b.vy += normal.y * impulse

            # B. NPC vs Player Solid Non-Penetration
            for npc in self.npcs:
                if npc.health <= 0.0:
                    continue
                diff = self.player.pos - npc.pos
                dist_sq = diff.length_sq()
                min_combat_dist = (npc.size + self.player.size) * 0.52

                if dist_sq < 0.01:
                    diff = Vector2(1.0, 0.0)
                    dist_sq = 1.0

                if dist_sq < min_combat_dist * min_combat_dist:
                    dist = math.sqrt(dist_sq)
                    overlap = min_combat_dist - dist
                    normal = diff / dist

                    npc.x -= normal.x * overlap * 0.7
                    npc.y -= normal.y * overlap * 0.7
                    self.player.x += normal.x * overlap * 0.3
                    self.player.y += normal.y * overlap * 0.3

                    rel_v = self.player.vel - npc.vel
                    normal_vel = rel_v.dot(normal)
                    if normal_vel < 0.0:
                        npc.vx -= normal.x * normal_vel * 0.5
                        npc.vy -= normal.y * normal_vel * 0.5

            # C. Re-constrain NPCs against crates and screen boundaries
            for npc in self.npcs:
                if npc.health <= 0.0:
                    continue
                half_size = npc.half_size
                for crate in self.crates:
                    npc.pos = resolve_box_collision(npc.pos, half_size, crate)
                npc.x = max(half_size, min(self.width - half_size, npc.x))
                npc.y = max(half_size, min(self.height - half_size, npc.y))

    def step(self, dt: float, move_x: float = 0.0, move_y: float = 0.0):
        """
        Single atomic simulation step.
        """
        if self.is_paused or self.is_game_over:
            return

        dt = min(0.05, dt)
        self.survival_time += dt
        self.tick_count += 1

        self.step_player(dt, move_x, move_y)
        self.step_npcs(dt)

    def trigger_player_pulse(self, radius: float = 220.0) -> int:
        """
        Triggers player shockwave pulse damaging nearby NPCs and knocking them back.
        Uses distance-attenuated damage formula matching TypeScript reference.
        Returns the number of NPCs hit.
        """
        if self.player.pulse_cooldown > 0.0:
            return 0

        self.player.pulse_cooldown = self.player.max_pulse_cooldown
        hits = 0
        p_center = self.player.pos

        for npc in self.npcs:
            if npc.health <= 0.0:
                continue
            dist = p_center.distance(npc.pos)
            if dist < radius:
                hits += 1
                damage = round(35.0 * (1.0 - dist / (radius * 1.2)))
                npc.health = max(0.0, npc.health - damage)
                npc.last_damage_time = self.survival_time
                # Knockback force
                push_dir = (npc.pos - p_center).normalize()
                if push_dir.length_sq() < 0.01:
                    push_dir = Vector2(0.0, -1.0)
                npc.vx += push_dir.x * 280.0
                npc.vy += push_dir.y * 280.0

        return hits

    def get_state_snapshot(self) -> dict:
        """
        Returns full serializable state dictionary ready for WebSocket streaming or logging.
        """
        return {
            "tick": self.tick_count,
            "survivalTime": round(self.survival_time, 2),
            "isGameOver": self.is_game_over,
            "isPaused": self.is_paused,
            "width": self.width,
            "height": self.height,
            "player": self.player.to_dict(),
            "npcs": [npc.to_dict() for npc in self.npcs],
            "crates": [c.to_dict() for c in self.crates],
            "healStations": [hs.to_dict() for hs in self.heal_stations],
        }
