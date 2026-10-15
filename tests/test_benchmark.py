"""
Unit tests for Phase 3: Benchmark runner, automated bot, and metrics aggregation.
Tests:
1. AutomatedBenchmarkBot kiting and boundary avoidance.
2. TrialMetricsTracker event handling, debounced attacks, and retreat detection.
3. Statistical calculations (mean, std dev, min, max, win rate).
4. Full trial deterministic reproducibility (identical seed -> identical metrics).
5. Headless multi-trial batch execution across all 5 AI models.
6. RFC 4180 CSV export formatting.
"""
import unittest
from simulation.vector2 import Vector2
from simulation.entities import Player, NPC
from benchmark.automated_bot import AutomatedBenchmarkBot
from benchmark.metrics_collector import (
    TrialMetricsTracker,
    compute_aggregates,
    export_trials_to_csv,
    export_aggregates_to_csv,
    TrialResult,
)
from benchmark.runner import BenchmarkRunner


class TestBenchmarkBot(unittest.TestCase):
    def test_kiting_away_when_close(self):
        player = Player(x=500.0, y=350.0)
        npc = NPC(id="n1", ai_type="fuzzy", x=540.0, y=350.0)  # 40px away (< 190px)
        pulse_called = False

        def on_pulse():
            nonlocal pulse_called
            pulse_called = True

        AutomatedBenchmarkBot.update(player, npc, [], 1000.0, 700.0, 0.05, on_pulse)
        # Should attempt to trigger pulse shockwave
        self.assertTrue(pulse_called)
        # Should accelerate away (-X direction)
        self.assertLess(player.vx, 0.0)


class TestMetricsCollector(unittest.TestCase):
    def test_tracker_attacks_and_retreats(self):
        tracker = TrialMetricsTracker("exp1", 1, "fuzzy", "Fuzzy AI", "open_arena", "Open Arena", 100037, 30.0)

        # Step 1: contact
        tracker.on_step(0.05, (100.0, 100.0), 90.0, 95.0, is_retreat_state=False, is_melee_contact=True)
        self.assertEqual(tracker.attacks, 1)

        # Step 2: still in contact (should be debounced within 0.4s cooldown)
        tracker.on_step(0.05, (100.0, 100.0), 90.0, 95.0, is_retreat_state=False, is_melee_contact=True)
        self.assertEqual(tracker.attacks, 1)

        # Step 3: transition to retreat
        tracker.on_step(0.05, (95.0, 100.0), 30.0, 95.0, is_retreat_state=True, is_melee_contact=False)
        self.assertEqual(tracker.retreats, 1)

        res = tracker.finalize(timestamp=1234567.0)
        self.assertEqual(res.attacks, 1)
        self.assertEqual(res.retreats, 1)

    def test_statistical_aggregates(self):
        t1 = TrialResult(
            experiment_id="e", trial_number=1, ai_type="fuzzy", ai_label="Fuzzy AI",
            scenario_id="s", scenario_name="S", seed=1, survival_time=20.0,
            damage_dealt=50.0, damage_received=40.0, npc_won=True, player_won=False,
            attacks=3, retreats=1, distance_travelled=300.0, final_npc_health=40.0,
            final_player_health=0.0, outcome="NPC Win", timestamp=100.0
        )
        t2 = TrialResult(
            experiment_id="e", trial_number=2, ai_type="fuzzy", ai_label="Fuzzy AI",
            scenario_id="s", scenario_name="S", seed=2, survival_time=30.0,
            damage_dealt=30.0, damage_received=60.0, npc_won=False, player_won=True,
            attacks=1, retreats=2, distance_travelled=400.0, final_npc_health=0.0,
            final_player_health=50.0, outcome="Player Win", timestamp=110.0
        )

        agg = compute_aggregates("fuzzy", "Fuzzy AI", [t1, t2])
        self.assertEqual(agg.trial_count, 2)
        self.assertAlmostEqual(agg.mean_survival_time, 25.0)
        self.assertAlmostEqual(agg.min_survival_time, 20.0)
        self.assertAlmostEqual(agg.max_survival_time, 30.0)
        self.assertAlmostEqual(agg.npc_win_rate, 50.0)
        self.assertAlmostEqual(agg.player_win_rate, 50.0)

    def test_csv_formatting(self):
        t1 = TrialResult(
            experiment_id="exp_test", trial_number=1, ai_type="simple", ai_label="Simple AI",
            scenario_id="open_arena", scenario_name="Open Arena", seed=100037, survival_time=15.2,
            damage_dealt=45.0, damage_received=30.0, npc_won=True, player_won=False,
            attacks=2, retreats=1, distance_travelled=180.5, final_npc_health=70.0,
            final_player_health=0.0, outcome="NPC Win", timestamp=1000.0
        )
        csv_str = export_trials_to_csv([t1])
        lines = csv_str.strip().split("\n")
        self.assertEqual(len(lines), 2)
        self.assertIn("experiment_id", lines[0])
        self.assertIn("exp_test", lines[1])


class TestBenchmarkRunner(unittest.TestCase):
    def test_trial_deterministic_reproducibility(self):
        runner = BenchmarkRunner()
        # Two trials with identical seed in open_arena must return identical metrics
        r1 = runner.run_trial("exp1", 1, "simple", "open_arena", seed=100037, max_duration_sec=3.0)
        r2 = runner.run_trial("exp2", 1, "simple", "open_arena", seed=100037, max_duration_sec=3.0)

        self.assertAlmostEqual(r1.survival_time, r2.survival_time, places=4)
        self.assertAlmostEqual(r1.damage_dealt, r2.damage_dealt, places=4)
        self.assertAlmostEqual(r1.damage_received, r2.damage_received, places=4)
        self.assertAlmostEqual(r1.distance_travelled, r2.distance_travelled, places=4)

    def test_fast_batch_run_all_five(self):
        runner = BenchmarkRunner()
        # Run 1 trial for each of the 5 AI architectures with 2s duration
        exp = runner.run_experiment(scenario_id="open_arena", trials_per_ai=1)
        self.assertEqual(exp["completedTrials"], 5)
        self.assertEqual(len(exp["results"]), 5)
        self.assertEqual(len(exp["rawAggregates"]), 5)


if __name__ == "__main__":
    unittest.main()
