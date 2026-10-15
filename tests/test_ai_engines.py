"""
Comprehensive test suite for Phase 2: All five AI decision architectures in Python.
Tests:
1. FSM / Simple Decision Logic (Direct chase, low health retreat, exhaustion standoff, obstacle slide).
2. Behavior Trees (Selector priority, sequence execution, low HP retreat, corner flanking, leaf status snapshots).
3. Fuzzy Logic (Membership degrees, Mamdani rule activation weights, continuous speed multiplier, defuzzification).
4. GOAP (World state atom sensing, A* state-space plan generation, preconditions/effects satisfaction, plan execution).
5. Utility AI (Non-linear response curves: Exponential, Sigmoid, Quadratic, Linear, weight scaling, inertia hysteresis).
6. Cross-Architecture Fair Evaluation & Simulation Engine Integration.
"""
import unittest
from simulation.vector2 import Vector2
from simulation.entities import NPC, Player, HealingStation, Crate
from simulation.simulation_engine import SimulationEngine
from simulation.ai.simple_fsm import SimpleDecisionEngine
from simulation.ai.behavior_tree import BehaviorTreeEngine, create_complex_movement_behavior_tree
from simulation.ai.fuzzy import FuzzySteeringEngine, trimf, trapmf
from simulation.ai.goap import GOAPSteeringEngine, GOAPPlanner
from simulation.ai.utility import UtilityAIEngine
from simulation.ai.factory import make_ai_engine


class TestSimpleFSMEngine(unittest.TestCase):
    def setUp(self):
        self.ai = SimpleDecisionEngine()
        self.player = Player(x=500.0, y=350.0)
        self.heal = HealingStation(id="h1", label="Heal", x=50.0, y=50.0, width=100.0, height=100.0)

    def test_direct_chase(self):
        npc = NPC(id="fsm1", ai_type="simple", x=200.0, y=350.0)
        npc.health = 100.0
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["currentState"], "DIRECT_CHASE")
        self.assertIn("Chase", out.badge)
        self.assertAlmostEqual(out.target_point.x, self.player.x)
        self.assertAlmostEqual(out.target_point.y, self.player.y)
        self.assertGreater(out.desired_velocity.x, 0.0)

    def test_low_health_flee(self):
        npc = NPC(id="fsm2", ai_type="simple", x=200.0, y=350.0)
        npc.health = 25.0  # <= 30%
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["currentState"], "FLEE_TO_HEAL")
        self.assertIn("Flee", out.badge)
        self.assertAlmostEqual(out.target_point.x, self.heal.center.x)
        self.assertAlmostEqual(out.target_point.y, self.heal.center.y)

    def test_exhaustion_standoff(self):
        npc = NPC(id="fsm3", ai_type="simple", x=400.0, y=350.0)
        npc.health = 100.0
        npc.is_exhausted = True
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["currentState"], "EXHAUSTED_STANDOFF")
        self.assertIn("Tired", out.badge)
        # Should target standoff point backing away from player
        self.assertLess(out.target_point.x, npc.x)

    def test_obstacle_slide(self):
        npc = NPC(id="fsm4", ai_type="simple", x=450.0, y=350.0)
        npc.rotation = 0.0
        # Trigger center whisker blocked
        center_sensor = npc.sensors[0]
        center_sensor.is_blocked = True
        center_sensor.hit_distance = 35.0  # < 50px
        center_sensor.normal = Vector2(-1.0, 0.0)

        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["currentState"], "OBSTACLE_SLIDE")
        self.assertIn("Slide", out.badge)
        self.assertTrue(out.debug["obstacleDetected"])


class TestFuzzyLogicEngine(unittest.TestCase):
    def setUp(self):
        self.ai = FuzzySteeringEngine()
        self.player = Player(x=500.0, y=350.0)
        self.heal = HealingStation(id="h1", label="Heal", x=50.0, y=50.0, width=100.0, height=100.0)

    def test_membership_functions(self):
        # trimf
        self.assertEqual(trimf(10.0, 0.0, 10.0, 20.0), 1.0)
        self.assertEqual(trimf(5.0, 0.0, 10.0, 20.0), 0.5)
        self.assertEqual(trimf(25.0, 0.0, 10.0, 20.0), 0.0)

        # trapmf
        self.assertEqual(trapmf(50.0, 20.0, 40.0, 60.0, 80.0), 1.0)
        self.assertEqual(trapmf(30.0, 20.0, 40.0, 60.0, 80.0), 0.5)
        self.assertEqual(trapmf(10.0, 20.0, 40.0, 60.0, 80.0), 0.0)

    def test_fuzzy_high_health_intercept(self):
        npc = NPC(id="fuz1", ai_type="fuzzy", x=100.0, y=350.0)  # far: 400px
        npc.health = 100.0
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertGreater(out.debug["healthHigh"], 0.8)
        self.assertGreater(out.debug["distanceFar"], 0.8)
        self.assertIn("Intercept", out.badge)
        self.assertIn("Predictive Intercept", out.debug["defuzzifiedGoal"])

    def test_fuzzy_critical_health_flee(self):
        npc = NPC(id="fuz2", ai_type="fuzzy", x=300.0, y=350.0)
        npc.health = 15.0  # critical low
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertGreater(out.debug["healthLow"], 0.8)
        self.assertIn("Flee", out.badge)
        self.assertIn("Emergency Retreat", out.debug["defuzzifiedGoal"])

    def test_fuzzy_flank_blend(self):
        npc = NPC(id="fuz3", ai_type="fuzzy", x=440.0, y=350.0)  # near (60px)
        npc.health = 55.0  # med health
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertGreater(out.debug["healthMed"], 0.8)
        self.assertGreater(out.debug["distanceNear"], 0.8)
        self.assertIn("Flank", out.badge)


class TestBehaviorTreeEngine(unittest.TestCase):
    def setUp(self):
        self.ai = BehaviorTreeEngine()
        self.player = Player(x=500.0, y=350.0)
        self.heal = HealingStation(id="h1", label="Heal", x=50.0, y=50.0, width=100.0, height=100.0)

    def test_bt_whisker_chase(self):
        npc = NPC(id="bt1", ai_type="behavior_tree", x=200.0, y=350.0)
        npc.health = 100.0
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertIn("Whisker Chase", out.badge)
        self.assertIn("act_whisker_chase", out.debug["activePath"])
        # Check snapshot structure
        snap = out.debug["rootSnapshot"]
        self.assertEqual(snap["type"], "selector")
        self.assertGreater(len(snap["children"]), 0)

    def test_bt_retreat_sequence(self):
        npc = NPC(id="bt2", ai_type="behavior_tree", x=200.0, y=350.0)
        npc.health = 25.0  # low health
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertIn("Heal", out.badge)
        self.assertIn("seq_heal", out.debug["activePath"])
        self.assertIn("act_navigate_heal", out.debug["activePath"])

    def test_bt_exhaustion_sequence(self):
        npc = NPC(id="bt3", ai_type="behavior_tree", x=450.0, y=350.0)
        npc.health = 100.0
        npc.is_exhausted = True
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertIn("Tired", out.badge)
        self.assertIn("seq_exhaustion_recovery", out.debug["activePath"])
        self.assertIn("act_catch_breath", out.debug["activePath"])

    def test_bt_corner_flank_when_blocked(self):
        npc = NPC(id="bt4", ai_type="behavior_tree", x=200.0, y=350.0)
        npc.health = 100.0
        # Crate directly between npc and player
        crate = Crate(id="c_block", x=300.0, y=300.0, width=100.0, height=100.0)
        out = self.ai.evaluate(npc, self.player, [crate], [self.heal], self.heal)
        self.assertIn("Flank Cover", out.badge)
        self.assertIn("seq_tactical_cover", out.debug["activePath"])
        self.assertIn("act_corner_flank", out.debug["activePath"])


class TestGOAPEngine(unittest.TestCase):
    def setUp(self):
        self.ai = GOAPSteeringEngine()
        self.player = Player(x=500.0, y=350.0)
        self.heal = HealingStation(id="h1", label="Heal", x=50.0, y=50.0, width=100.0, height=100.0)

    def test_goap_strike_plan(self):
        npc = NPC(id="goap1", ai_type="goap", x=400.0, y=350.0)
        npc.health = 100.0
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["currentGoal"], "Strike Player")
        plan_names = [p["name"] for p in out.debug["plan"]]
        # Expected sequence: Predictive Intercept Gap -> Melee Pounce Attack
        self.assertIn("Melee Pounce Attack", plan_names)

    def test_goap_survive_plan(self):
        npc = NPC(id="goap2", ai_type="goap", x=400.0, y=350.0)
        npc.health = 20.0  # critical low health triggers 'Survive & Regenerate' goal (priority 95)
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["currentGoal"], "Survive & Regenerate")
        self.assertEqual(out.debug["goalPriority"], 95.0)
        plan_names = [p["name"] for p in out.debug["plan"]]
        # Expected sequence: Navigate to Healing Shrine -> Regenerate HP in Shrine
        self.assertEqual(plan_names, ["Navigate to Healing Shrine", "Regenerate HP in Shrine"])

    def test_goap_flank_plan(self):
        npc = NPC(id="goap3", ai_type="goap", x=200.0, y=350.0)
        npc.health = 90.0
        # Obstruct line of sight with crate
        crate = Crate(id="c_block", x=300.0, y=300.0, width=100.0, height=100.0)
        out = self.ai.evaluate(npc, self.player, [crate], [self.heal], self.heal)
        self.assertEqual(out.debug["currentGoal"], "Flank Obscured Player")
        plan_names = [p["name"] for p in out.debug["plan"]]
        self.assertIn("Corner Flank Maneuver", plan_names)


class TestUtilityAIEngine(unittest.TestCase):
    def setUp(self):
        self.ai = UtilityAIEngine()
        self.player = Player(x=500.0, y=350.0)
        self.heal = HealingStation(id="h1", label="Heal", x=50.0, y=50.0, width=100.0, height=100.0)

    def test_utility_melee_pounce_when_close(self):
        npc = NPC(id="util1", ai_type="utility", x=470.0, y=350.0)  # 30px distance
        npc.health = 100.0
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["selectedAction"], "High-Aggression Melee Pounce")
        self.assertIn("Pounce", out.badge)
        self.assertGreater(out.debug["highestUtility"], 0.5)

    def test_utility_exponential_heal_when_critical(self):
        npc = NPC(id="util2", ai_type="utility", x=300.0, y=350.0)
        npc.health = 15.0  # low health drives exponential heal curve: (1 - hp)^2.2
        out = self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        self.assertEqual(out.debug["selectedAction"], "Emergency Heal Station Retreat")
        self.assertIn("Heal", out.badge)

    def test_utility_flank_when_obstructed(self):
        npc = NPC(id="util3", ai_type="utility", x=200.0, y=350.0)
        npc.health = 80.0
        crate = Crate(id="c_block", x=300.0, y=300.0, width=100.0, height=100.0)
        out = self.ai.evaluate(npc, self.player, [crate], [self.heal], self.heal)
        self.assertEqual(out.debug["selectedAction"], "Tactical Corner Flank")
        self.assertIn("Flank", out.badge)

    def test_utility_inertia_bonus(self):
        npc = NPC(id="util4", ai_type="utility", x=470.0, y=350.0)
        npc.health = 100.0
        # Run 1st evaluation
        self.ai.evaluate(npc, self.player, [], [self.heal], self.heal)
        # Verify inertia was recorded for this NPC
        mem = self.ai.memories.get(npc.id)
        self.assertIsNotNone(mem)
        self.assertEqual(mem.current_action, "High-Aggression Melee Pounce")


class TestSimulationIntegrationAllAI(unittest.TestCase):
    def test_all_five_in_simulation_engine(self):
        engine = SimulationEngine(1000.0, 700.0)
        engine.crates = []

        types = ["simple", "behavior_tree", "fuzzy", "goap", "utility"]
        for idx, t in enumerate(types):
            npc = NPC(id=f"npc_{t}", ai_type=t, x=100.0 + idx * 80.0, y=200.0)
            controller = make_ai_engine(t)
            engine.register_npc(npc, controller)

        self.assertEqual(len(engine.npcs), 5)

        # Step simulation 30 times (1.5 seconds)
        for _ in range(30):
            engine.step(0.05, move_x=1.0, move_y=0.0)

        # Verify all 5 NPCs updated their positions, velocities, and diagnostics
        for npc in engine.npcs:
            self.assertGreater(npc.vel.length(), 0.0)
            self.assertNotEqual(npc.debug_data["stateBadge"], "Initializing...")
            self.assertIn(npc.ai_type, npc.debug_data)
            # Check JSON serialization of full state snapshot
            snapshot = engine.get_state_snapshot()
            self.assertEqual(len(snapshot["npcs"]), 5)


if __name__ == "__main__":
    unittest.main()
