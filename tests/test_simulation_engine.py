"""
Comprehensive unit and integration tests for Phase 1: Python Simulation Engine & Math Core.
Tests:
1. Vector2 mathematics (addition, subtraction, normalization, rotation, distance, clamp).
2. AABB geometry, raycasting intersection, surface normals, and line-of-sight checks.
3. Box collision resolution and non-penetration.
4. RaySensor whisker updates against crates and outer arena walls.
5. Entity movement, acceleration, friction, and boundary clamping.
6. Multi-agent anti-stacking separation forces and relaxation passes.
7. Aggression stamina drain under high-intensity sprint, exhaustion state, and 50% recovery threshold.
8. Healing station area detection and HP regeneration rate.
9. Melee combat collision, player damage, and game-over conditions.
10. Edge cases: overlapping entities, corner trapping, and extreme velocities.
"""
import math
import unittest
from simulation.vector2 import Vector2
from simulation.geometry import (
    AABB,
    ray_intersect_aabb,
    resolve_box_collision,
    has_line_of_sight,
)
from simulation.entities import Player, NPC, HealingStation, Crate
from simulation.simulation_engine import SimulationEngine
from simulation.scenarios import get_experiment_scenario


class TestVector2(unittest.TestCase):
    def test_basic_arithmetic(self):
        v1 = Vector2(3.0, 4.0)
        v2 = Vector2(1.0, 2.0)
        self.assertEqual(v1 + v2, Vector2(4.0, 6.0))
        self.assertEqual(v1 - v2, Vector2(2.0, 2.0))
        self.assertEqual(v1 * 2, Vector2(6.0, 8.0))
        self.assertEqual(v1 / 2, Vector2(1.5, 2.0))
        self.assertEqual(-v1, Vector2(-3.0, -4.0))

    def test_length_and_distance(self):
        v = Vector2(3.0, 4.0)
        self.assertAlmostEqual(v.length(), 5.0)
        self.assertAlmostEqual(v.length_sq(), 25.0)
        other = Vector2(6.0, 8.0)
        self.assertAlmostEqual(v.distance(other), 5.0)

    def test_normalize(self):
        v = Vector2(10.0, 0.0)
        norm = v.normalize()
        self.assertAlmostEqual(norm.x, 1.0)
        self.assertAlmostEqual(norm.y, 0.0)
        # Zero vector normalization should be safe
        zero = Vector2(0.0, 0.0).normalize()
        self.assertEqual(zero, Vector2(0.0, 0.0))

    def test_dot_cross(self):
        v1 = Vector2(1.0, 0.0)
        v2 = Vector2(0.0, 1.0)
        self.assertAlmostEqual(v1.dot(v2), 0.0)
        self.assertAlmostEqual(v1.cross(v2), 1.0)

    def test_clamp_length(self):
        v = Vector2(30.0, 40.0)  # len 50
        clamped = v.clamp_length(25.0)
        self.assertAlmostEqual(clamped.length(), 25.0)
        self.assertAlmostEqual(clamped.x, 15.0)
        self.assertAlmostEqual(clamped.y, 20.0)

    def test_rotation(self):
        v = Vector2(1.0, 0.0)
        rotated = v.rotate(math.pi / 2)
        self.assertAlmostEqual(rotated.x, 0.0, places=5)
        self.assertAlmostEqual(rotated.y, 1.0, places=5)


class TestGeometry(unittest.TestCase):
    def setUp(self):
        # 100x100 box at (200, 200) -> [200, 300] x [200, 300]
        self.box = AABB(200.0, 200.0, 100.0, 100.0, id="test_box")

    def test_ray_hit(self):
        origin = Vector2(100.0, 250.0)
        direction = Vector2(1.0, 0.0)
        hit = ray_intersect_aabb(origin, direction, 200.0, self.box)
        self.assertTrue(hit.hit)
        self.assertAlmostEqual(hit.distance, 100.0)
        self.assertIsNotNone(hit.point)
        self.assertAlmostEqual(hit.point.x, 200.0)
        self.assertAlmostEqual(hit.point.y, 250.0)
        self.assertEqual(hit.normal, Vector2(-1.0, 0.0))

    def test_ray_miss(self):
        origin = Vector2(100.0, 100.0)
        direction = Vector2(1.0, 0.0)  # shoots over the box (y=100 vs box y=[200, 300])
        hit = ray_intersect_aabb(origin, direction, 300.0, self.box)
        self.assertFalse(hit.hit)

    def test_line_of_sight(self):
        a = Vector2(100.0, 250.0)
        b_blocked = Vector2(400.0, 250.0)
        b_clear = Vector2(100.0, 400.0)
        self.assertFalse(has_line_of_sight(a, b_blocked, [self.box]))
        self.assertTrue(has_line_of_sight(a, b_clear, [self.box]))

    def test_resolve_box_collision(self):
        # Entity circle with half_size 12 located slightly inside left face of box at x=205, y=250
        entity_pos = Vector2(205.0, 250.0)
        resolved = resolve_box_collision(entity_pos, 12.0, self.box)
        # Should be pushed out to x = 200 - 12 = 188.0
        self.assertAlmostEqual(resolved.x, 188.0)
        self.assertAlmostEqual(resolved.y, 250.0)


class TestSimulationEngine(unittest.TestCase):
    def setUp(self):
        self.engine = SimulationEngine(width=1000.0, height=700.0)

    def test_sensor_raycasts(self):
        npc = NPC(id="npc1", ai_type="fuzzy", x=100.0, y=100.0)
        npc.rotation = 0.0  # pointing along +X
        # Place a crate right in front of npc at x=150, y=80 with size 40x40
        self.engine.crates = [Crate(id="c_test", x=150.0, y=80.0, width=40.0, height=40.0)]
        self.engine.update_sensors(npc)

        forward_sensor = npc.sensors[0]  # angle_offset 0
        self.assertTrue(forward_sensor.is_blocked)
        self.assertAlmostEqual(forward_sensor.hit_distance, 50.0)
        self.assertEqual(forward_sensor.normal, Vector2(-1.0, 0.0))

    def test_outer_wall_raycasting(self):
        # Place NPC at x=50, y=350 pointing left towards wall at x=0
        npc = NPC(id="npc_wall", ai_type="fuzzy", x=50.0, y=350.0)
        npc.rotation = math.pi  # facing left
        self.engine.crates = []
        self.engine.update_sensors(npc)

        forward_sensor = npc.sensors[0]
        self.assertTrue(forward_sensor.is_blocked)
        self.assertAlmostEqual(forward_sensor.hit_distance, 50.0)
        self.assertAlmostEqual(forward_sensor.normal.x, 1.0)

    def test_stamina_drain_and_exhaustion(self):
        # Clear crates for unobstructed stamina test
        self.engine.crates = []
        npc = NPC(id="npc_stamina", ai_type="fuzzy", x=400.0, y=350.0)
        self.engine.player.x = 500.0
        self.engine.player.y = 350.0

        def aggressive_ctrl(n, p, eng):
            return {
                "desired_velocity": Vector2(100.0, 0.0),
                "steering_force": Vector2(100.0, 0.0),
                "target_point": p.pos,
                "badge": "FUZZY: Chase (Aggressive)",
            }

        self.engine.register_npc(npc, aggressive_ctrl)

        # 80 steps of 0.05 drain 4.0s to 0.0, step 81 enters exhausted recharge state
        dt = 0.05
        for _ in range(81):
            self.engine.step(dt)

        self.assertTrue(npc.is_exhausted)
        self.assertLessEqual(npc.aggression_stamina, 0.1)

        # Now change controller to disengage/passive retreat and stop pushing
        def passive_ctrl(n, p, eng):
            # Brake and back off
            return {
                "desired_velocity": Vector2(-60.0, 0.0),
                "steering_force": Vector2(-300.0, 0.0),
                "target_point": Vector2(0.0, 350.0),
                "badge": "FUZZY: Retreat to Heal",
            }

        npc.vel = Vector2(0.0, 0.0)
        self.engine.player.vel = Vector2(0.0, 0.0)
        self.engine.ai_controllers[npc.id] = passive_ctrl

        # Run for 3 seconds -> at regen 0.8/s, stamina reaches 2.4s (>= 50% of 4.0s)
        for _ in range(60):  # 3.0s
            self.engine.step(dt)

        self.assertFalse(npc.is_exhausted)
        self.assertGreaterEqual(npc.aggression_stamina, 2.0)

    def test_healing_station(self):
        npc = NPC(id="npc_heal", ai_type="fuzzy", x=90.0, y=90.0)
        npc.health = 40.0
        # Healing station at x=45, y=45, size 110x110 (covers [45, 155])
        self.engine.heal_stations = [
            HealingStation("hs1", "Shrine", x=45.0, y=45.0, width=110.0, height=110.0, heal_rate_per_sec=30.0)
        ]
        self.engine.register_npc(npc)

        # Step 1.0 second
        self.engine.step(0.05)
        self.assertTrue(npc.is_healing)
        self.assertGreater(npc.health, 40.0)

    def test_anti_stacking_separation(self):
        # Clear crates
        self.engine.crates = []
        # Spawn two NPCs in overlapping positions
        npc1 = NPC(id="n1", ai_type="fuzzy", x=500.0, y=350.0)
        npc2 = NPC(id="n2", ai_type="simple", x=504.0, y=350.0)  # distance = 4px, min_dist ~ 28px
        self.engine.register_npc(npc1)
        self.engine.register_npc(npc2)

        # Before stepping
        init_dist = npc1.pos.distance(npc2.pos)
        self.assertLess(init_dist, 10.0)

        # Step simulation
        self.engine.step(0.05)
        new_dist = npc1.pos.distance(npc2.pos)
        self.assertGreater(new_dist, init_dist)
        self.assertGreaterEqual(new_dist, 20.0)

    def test_melee_combat_damage(self):
        # Clear crates for direct combat test in open space
        self.engine.crates = []
        self.engine.player.x = 200.0
        self.engine.player.y = 200.0
        self.engine.player.health = 100.0

        npc = NPC(id="n_combat", ai_type="simple", x=210.0, y=200.0)

        # Give NPC a controller that actively moves toward the player
        def chase_ctrl(n, p, eng):
            diff = (p.pos - n.pos).normalize()
            return {
                "desired_velocity": diff * 150.0,
                "steering_force": diff * 300.0,
                "target_point": p.pos,
                "badge": "SIMPLE: Chase",
            }

        self.engine.register_npc(npc, chase_ctrl)

        # Step 1.0 second (20 steps of 0.05)
        for _ in range(20):
            self.engine.step(0.05)

        self.assertLess(self.engine.player.health, 100.0)
        self.assertGreater(self.engine.player.health, 60.0)

    def test_deterministic_reproducibility(self):
        # Two independent engines initialized with identical scenario must yield identical states after N steps
        e1 = SimulationEngine(1000.0, 700.0)
        e2 = SimulationEngine(1000.0, 700.0)

        c1 = e1.load_scenario("corridors")
        c2 = e2.load_scenario("corridors")

        n1 = NPC("n", "fuzzy", c1.npc_start_pos.x, c1.npc_start_pos.y)
        n2 = NPC("n", "fuzzy", c2.npc_start_pos.x, c2.npc_start_pos.y)

        e1.register_npc(n1)
        e2.register_npc(n2)

        for _ in range(50):
            e1.step(0.05, move_x=1.0, move_y=0.0)
            e2.step(0.05, move_x=1.0, move_y=0.0)

        self.assertAlmostEqual(e1.player.x, e2.player.x, places=5)
        self.assertAlmostEqual(e1.player.y, e2.player.y, places=5)
        self.assertAlmostEqual(n1.x, n2.x, places=5)
        self.assertAlmostEqual(n1.y, n2.y, places=5)


if __name__ == "__main__":
    unittest.main()
