"""
Deterministic automated benchmark bot for controlled evaluation trials.
Ensures that all 5 AI architectures face the exact identical opponent behavior,
kiting dynamics, obstacle avoidance, and shockwave pulse defenses.
Faithfully ported from TypeScript reference.
"""
from typing import List, Optional
from simulation.vector2 import Vector2
from simulation.entities import Player, NPC, Crate


class AutomatedBenchmarkBot:
    """
    Deterministic benchmark opponent:
    1. Kiting spacing (~180px away from target NPC).
    2. Tactical shockwave pulse defense when NPC enters < 135px and pulse cooldown is ready.
    3. Perimeter boundary repulsion to avoid hugging walls.
    4. Crate obstacle avoidance push forces.
    """

    @staticmethod
    def update(
        player: Player,
        npc: NPC,
        crates: List[Crate],
        width: float,
        height: float,
        dt: float,
        trigger_pulse_fn
    ):
        dist_to_npc = player.pos.distance(npc.pos)

        # 1. Tactical pulse shockwave defense
        if dist_to_npc < 135.0 and player.pulse_cooldown <= 0.0:
            trigger_pulse_fn()

        # 2. Deterministic steering movement
        move_dir = Vector2(0.0, 0.0)

        if dist_to_npc < 190.0:
            # Kite away from NPC
            diff = player.pos - npc.pos
            away_dir = diff.normalize() if diff.length_sq() > 1e-4 else Vector2(1.0, 0.0)
            # Add slight perpendicular orbital tangent to avoid getting cornered against walls
            tangent = Vector2(-away_dir.y, away_dir.x)
            move_dir = (away_dir * 0.75 + tangent * 0.45).normalize()
        elif dist_to_npc > 340.0:
            # Advance cautiously back toward engagement zone
            diff = npc.pos - player.pos
            move_dir = diff.normalize() if diff.length_sq() > 1e-4 else Vector2(1.0, 0.0)
        else:
            # Orbit / strafe at optimal combat range
            diff = npc.pos - player.pos
            to_npc = diff.normalize() if diff.length_sq() > 1e-4 else Vector2(1.0, 0.0)
            move_dir = Vector2(-to_npc.y, to_npc.x)

        # 3. Perimeter boundary repulsion
        bound_margin = 70.0
        if player.x < bound_margin:
            move_dir.x += 1.5
        if player.x > width - bound_margin:
            move_dir.x -= 1.5
        if player.y < bound_margin:
            move_dir.y += 1.5
        if player.y > height - bound_margin:
            move_dir.y -= 1.5

        # 4. Obstacle avoidance against crates
        for crate in crates:
            c_center = crate.center
            d_crate = player.pos.distance(c_center)
            safe_radius = max(crate.width, crate.height) * 0.75 + 30.0
            if d_crate < safe_radius:
                diff_c = player.pos - c_center
                push_away = diff_c.normalize() if diff_c.length_sq() > 1e-4 else Vector2(1.0, 0.0)
                move_dir += push_away * 1.8

        move_dir = move_dir.normalize()
        if move_dir.length_sq() < 1e-4:
            move_dir = Vector2(0.0, 0.0)

        # 5. Physics integration
        accel = 800.0
        friction = 6.5

        player.vx += move_dir.x * accel * dt
        player.vy += move_dir.y * accel * dt

        player.vx -= player.vx * friction * dt
        player.vy -= player.vy * friction * dt

        current_speed = player.vel.length()
        max_speed = player.max_speed * 0.88
        if current_speed > max_speed:
            player.vel = player.vel.clamp_length(max_speed)

        # Cooldowns
        if player.pulse_cooldown > 0.0:
            player.pulse_cooldown = max(0.0, player.pulse_cooldown - dt)
        if player.damage_flash > 0.0:
            player.damage_flash = max(0.0, player.damage_flash - dt)
