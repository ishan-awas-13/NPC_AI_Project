"""
Interactive 2D Continuous Arena Sandbox Visualizer (Pygame).
Runs the continuous physics simulation engine with all 5 AI algorithms.

Controls:
  WASD / Arrow Keys : Move Player
  SPACE             : Trigger Player Shockwave Pulse
  P                 : Pause / Resume simulation
  1 - 5             : Select active NPC for inspector overlay (1: Simple, 2: BT, 3: Fuzzy, 4: GOAP, 5: Utility)
  F1 - F4           : Switch arena map preset (F1: Tactical, F2: Pillars, F3: Corridors, F4: Scattered)
  K                 : Damage all NPCs (-35 HP) to test emergency healing & survival loops
  R                 : Reset Arena
  ESC               : Quit
"""
import sys
import math
import pygame
from simulation.vector2 import Vector2
from simulation.entities import NPC, Player, Crate, HealingStation
from simulation.simulation_engine import SimulationEngine
from simulation.ai.factory import make_ai_engine

WINDOW_WIDTH = 1000
WINDOW_HEIGHT = 700
HUD_HEIGHT = 90
TOTAL_HEIGHT = WINDOW_HEIGHT + HUD_HEIGHT

COLORS = {
    "bg": (15, 23, 42),          # Slate 900
    "grid": (30, 41, 59),        # Slate 800
    "player": (59, 130, 246),    # Blue 500
    "player_outline": (147, 197, 253),
    "crate": (51, 65, 85),       # Slate 700
    "crate_border": (100, 116, 139),
    "shrine": (16, 185, 129, 60), # Emerald
    "shrine_border": (52, 211, 153),
    "text": (241, 245, 249),
    "text_muted": (148, 163, 184),
    "hud_bg": (11, 15, 25),
    "hp_green": (34, 197, 94),
    "hp_red": (239, 68, 68),
    "stamina_cyan": (6, 182, 212),
    "stamina_exhausted": (249, 115, 22),
    # AI Color themes
    "simple": (245, 158, 11),     # Amber
    "behavior_tree": (139, 92, 246), # Violet
    "fuzzy": (6, 182, 212),       # Cyan
    "goap": (59, 130, 246),       # Blue
    "utility": (244, 63, 94),     # Rose
}


def main():
    pygame.init()
    screen = pygame.display.set_mode((WINDOW_WIDTH, TOTAL_HEIGHT))
    pygame.display.set_caption("NPC AI Continuous Steering Benchmark Arena - 5 Architectures")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("consolas", 14)
    font_bold = pygame.font.SysFont("consolas", 15, bold=True)
    font_large = pygame.font.SysFont("consolas", 18, bold=True)

    engine = SimulationEngine(width=WINDOW_WIDTH, height=WINDOW_HEIGHT)

    # Spawn 1 of each of the 5 AI architectures
    ai_configs = [
        ("simple", "Simple Decision AI", 850.0, 580.0),
        ("behavior_tree", "Behavior Tree AI", 850.0, 120.0),
        ("fuzzy", "Fuzzy Logic AI", 150.0, 580.0),
        ("goap", "GOAP Planner AI", 150.0, 120.0),
        ("utility", "Utility AI", 500.0, 600.0),
    ]

    for ai_type, name, x, y in ai_configs:
        npc = NPC(id=f"npc_{ai_type}", ai_type=ai_type, x=x, y=y, name=name)
        controller = make_ai_engine(ai_type)
        engine.register_npc(npc, controller)

    selected_index = 2  # Default to Fuzzy Logic
    paused = False
    running = True

    while running:
        dt = clock.tick(60) / 1000.0  # Real-time delta clamped at 60 FPS
        dt = min(0.05, dt)

        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                elif event.key == pygame.K_p:
                    paused = not paused
                elif event.key == pygame.K_SPACE:
                    engine.trigger_player_pulse()
                elif event.key == pygame.K_k:
                    # Damage all NPCs by 35 to test emergency self-preservation loops
                    for n in engine.npcs:
                        n.health = max(10.0, n.health - 35.0)
                elif event.key == pygame.K_r:
                    # Reset positions and health
                    engine.load_preset(engine.current_preset)
                    engine.player.x = WINDOW_WIDTH * 0.5
                    engine.player.y = WINDOW_HEIGHT * 0.5
                    engine.player.vx = 0.0
                    engine.player.vy = 0.0
                    engine.player.health = 100.0
                    for i, (ai_type, name, x, y) in enumerate(ai_configs):
                        engine.npcs[i].x = x
                        engine.npcs[i].y = y
                        engine.npcs[i].vx = 0.0
                        engine.npcs[i].vy = 0.0
                        engine.npcs[i].health = 100.0
                        engine.npcs[i].aggression_stamina = 4.0
                        engine.npcs[i].is_exhausted = False
                elif event.key == pygame.K_1:
                    selected_index = 0
                elif event.key == pygame.K_2:
                    selected_index = 1
                elif event.key == pygame.K_3:
                    selected_index = 2
                elif event.key == pygame.K_4:
                    selected_index = 3
                elif event.key == pygame.K_5:
                    selected_index = 4
                elif event.key == pygame.K_F1:
                    engine.load_preset("tactical")
                elif event.key == pygame.K_F2:
                    engine.load_preset("pillars")
                elif event.key == pygame.K_F3:
                    engine.load_preset("corridors")
                elif event.key == pygame.K_F4:
                    engine.load_preset("scattered")

        # Player inputs (continuous)
        move_x = 0.0
        move_y = 0.0
        keys = pygame.key.get_pressed()
        if keys[pygame.K_w] or keys[pygame.K_UP]:
            move_y -= 1.0
        if keys[pygame.K_s] or keys[pygame.K_DOWN]:
            move_y += 1.0
        if keys[pygame.K_a] or keys[pygame.K_LEFT]:
            move_x -= 1.0
        if keys[pygame.K_d] or keys[pygame.K_RIGHT]:
            move_x += 1.0

        if not paused:
            engine.step(dt, move_x, move_y)

        # ---------------- RENDER ----------------
        screen.fill(COLORS["bg"])

        # Grid lines
        for gx in range(0, WINDOW_WIDTH, 50):
            pygame.draw.line(screen, COLORS["grid"], (gx, 0), (gx, WINDOW_HEIGHT), 1)
        for gy in range(0, WINDOW_HEIGHT, 50):
            pygame.draw.line(screen, COLORS["grid"], (0, gy), (WINDOW_WIDTH, gy), 1)

        # Healing stations
        for hs in engine.heal_stations:
            hs_surf = pygame.Surface((int(hs.width), int(hs.height)), pygame.SRCALPHA)
            hs_surf.fill((16, 185, 129, 45))
            screen.blit(hs_surf, (int(hs.x), int(hs.y)))
            pygame.draw.rect(screen, COLORS["shrine_border"], (int(hs.x), int(hs.y), int(hs.width), int(hs.height)), 2)
            lbl = font.render(hs.label, True, (52, 211, 153))
            screen.blit(lbl, (int(hs.x) + 6, int(hs.y) + 6))

        # Crates
        for c in engine.crates:
            rect = pygame.Rect(int(c.x), int(c.y), int(c.width), int(c.height))
            pygame.draw.rect(screen, COLORS["crate"], rect)
            pygame.draw.rect(screen, COLORS["crate_border"], rect, 2)
            if c.label:
                c_lbl = font.render(c.label, True, (148, 163, 184))
                screen.blit(c_lbl, (int(c.x) + 4, int(c.y) + 4))

        # Selected NPC
        selected_npc = engine.npcs[selected_index] if selected_index < len(engine.npcs) else None

        # Draw NPCs
        for i, npc in enumerate(engine.npcs):
            is_selected = (i == selected_index)
            color = COLORS.get(npc.ai_type, (200, 200, 200))

            # Ray sensors (whiskers)
            for sensor in npc.sensors:
                heading = npc.rotation + sensor.angle_offset
                s_dir = Vector2.from_heading(heading)
                hit_len = sensor.hit_distance
                end_x = npc.x + s_dir.x * hit_len
                end_y = npc.y + s_dir.y * hit_len
                ray_color = (239, 68, 68) if sensor.is_blocked else (71, 85, 105)
                pygame.draw.line(screen, ray_color, (int(npc.x), int(npc.y)), (int(end_x), int(end_y)), 1)
                if sensor.is_blocked and sensor.hit_point:
                    pygame.draw.circle(screen, (239, 68, 68), (int(sensor.hit_point.x), int(sensor.hit_point.y)), 3)

            # Target line for selected NPC
            if is_selected:
                target_pt = npc.debug_data.get("targetPoint")
                if target_pt:
                    pygame.draw.line(screen, (244, 114, 182), (int(npc.x), int(npc.y)), (int(target_pt["x"]), int(target_pt["y"])), 1)
                    pygame.draw.circle(screen, (244, 114, 182), (int(target_pt["x"]), int(target_pt["y"])), 4, 1)

            # NPC body
            half = npc.half_size
            npc_rect = pygame.Rect(int(npc.x - half), int(npc.y - half), int(npc.size), int(npc.size))
            pygame.draw.rect(screen, color, npc_rect)
            border_color = (255, 255, 255) if is_selected else (20, 20, 20)
            pygame.draw.rect(screen, border_color, npc_rect, 2 if not is_selected else 3)

            # Heading indicator
            head_dir = Vector2.from_heading(npc.rotation)
            pygame.draw.line(
                screen,
                (255, 255, 255),
                (int(npc.x), int(npc.y)),
                (int(npc.x + head_dir.x * (half + 8)), int(npc.y + head_dir.y * (half + 8))),
                2
            )

            # Overhead HP bar
            bar_w = 32
            bar_h = 4
            hp_w = int(bar_w * (npc.health / npc.max_health))
            pygame.draw.rect(screen, (30, 30, 30), (int(npc.x - bar_w / 2), int(npc.y - half - 10), bar_w, bar_h))
            pygame.draw.rect(screen, COLORS["hp_green"], (int(npc.x - bar_w / 2), int(npc.y - half - 10), hp_w, bar_h))

            # Overhead Stamina bar
            stamina_ratio = npc.aggression_stamina / npc.max_aggression_stamina
            stam_w = int(bar_w * stamina_ratio)
            stam_color = COLORS["stamina_exhausted"] if npc.is_exhausted else COLORS["stamina_cyan"]
            pygame.draw.rect(screen, (30, 30, 30), (int(npc.x - bar_w / 2), int(npc.y - half - 5), bar_w, 3))
            pygame.draw.rect(screen, stam_color, (int(npc.x - bar_w / 2), int(npc.y - half - 5), stam_w, 3))

            # Badge text
            badge_text = npc.debug_data.get("stateBadge", "")
            badge_surf = font.render(f"[{i+1}] {badge_text}", True, color)
            screen.blit(badge_surf, (int(npc.x - bar_w / 2), int(npc.y + half + 4)))

        # Draw Player
        p = engine.player
        p_half = p.half_size
        p_rect = pygame.Rect(int(p.x - p_half), int(p.y - p_half), int(p.size), int(p.size))
        p_color = (255, 100, 100) if p.damage_flash > 0 else COLORS["player"]
        pygame.draw.rect(screen, p_color, p_rect)
        pygame.draw.rect(screen, COLORS["player_outline"], p_rect, 2)
        # Player heading
        p_head = Vector2.from_heading(p.rotation)
        pygame.draw.line(screen, (255, 255, 255), (int(p.x), int(p.y)), (int(p.x + p_head.x * 18), int(p.y + p_head.y * 18)), 2)

        # Overhead player HP
        p_bar_w = 40
        p_hp_w = int(p_bar_w * (p.health / p.max_health))
        pygame.draw.rect(screen, (30, 30, 30), (int(p.x - p_bar_w / 2), int(p.y - p_half - 10), p_bar_w, 4))
        pygame.draw.rect(screen, (59, 130, 246), (int(p.x - p_bar_w / 2), int(p.y - p_half - 10), p_hp_w, 4))

        # ---------------- BOTTOM INSPECTOR HUD ----------------
        hud_rect = pygame.Rect(0, WINDOW_HEIGHT, WINDOW_WIDTH, HUD_HEIGHT)
        pygame.draw.rect(screen, COLORS["hud_bg"], hud_rect)
        pygame.draw.line(screen, (51, 65, 85), (0, WINDOW_HEIGHT), (WINDOW_WIDTH, WINDOW_HEIGHT), 2)

        # Controls column (left)
        ctrl_title = font_bold.render("CONTROLS:", True, (148, 163, 184))
        ctrl_line1 = font.render("[WASD]: Move Player  [SPACE]: Shockwave Pulse  [P]: Pause  [R]: Reset", True, COLORS["text"])
        ctrl_line2 = font.render("[1-5]: Inspect AI  [F1-F4]: Map Presets  [K]: Damage All (-35 HP)", True, (203, 213, 225))
        screen.blit(ctrl_title, (12, WINDOW_HEIGHT + 6))
        screen.blit(ctrl_line1, (12, WINDOW_HEIGHT + 26))
        screen.blit(ctrl_line2, (12, WINDOW_HEIGHT + 46))

        # Selected NPC Inspector (right)
        if selected_npc:
            ai_key = selected_npc.ai_type
            diag = selected_npc.debug_data.get(ai_key, {})
            theme_color = COLORS.get(ai_key, (255, 255, 255))

            ins_title = font_large.render(
                f"INSPECTOR: {selected_npc.name.upper()} (HP: {round(selected_npc.health)} | Stamina: {round(selected_npc.aggression_stamina, 1)}s)",
                True,
                theme_color
            )
            screen.blit(ins_title, (480, WINDOW_HEIGHT + 6))

            # Specific diagnostic metrics
            diag_str = ""
            if ai_key == "simple":
                diag_str = f"State: {diag.get('currentState')} | Obstacle Blocked: {diag.get('obstacleDetected')} | Reason: {diag.get('reason')}"
            elif ai_key == "behavior_tree":
                active = " -> ".join(diag.get("activePath", [])[-3:])
                diag_str = f"Active Action: {diag.get('currentAction')} | Path: {active}"
            elif ai_key == "fuzzy":
                diag_str = f"Goal: {diag.get('defuzzifiedGoal')} | SpeedMult: {diag.get('speedMultiplier')}x | Near: {diag.get('distanceNear')} Med: {diag.get('distanceMed')} Far: {diag.get('distanceFar')}"
            elif ai_key == "goap":
                diag_str = f"Active Goal: {diag.get('currentGoal')} | Action: {diag.get('currentActionName')} | Plan Cost: {round(diag.get('totalPlanCost', 0), 1)} | Replans: {diag.get('replanCount')}"
            elif ai_key == "utility":
                diag_str = f"Selected Action: {diag.get('selectedAction')} | Winning Score: {diag.get('highestUtility')} | Hysteresis: Active"

            diag_surf = font.render(diag_str[:90], True, COLORS["text"])
            screen.blit(diag_surf, (480, WINDOW_HEIGHT + 32))

            status_surf = font.render(
                f"Map: {engine.current_preset.capitalize()} | Player HP: {round(p.health)} | Pulse: {'READY' if p.pulse_cooldown <= 0 else f'{round(p.pulse_cooldown, 1)}s'} | Status: {'PAUSED' if paused else 'RUNNING'}",
                True,
                (148, 163, 184)
            )
            screen.blit(status_surf, (480, WINDOW_HEIGHT + 54))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
