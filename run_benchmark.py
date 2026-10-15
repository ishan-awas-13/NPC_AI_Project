"""
Command-line Benchmark Runner CLI.
Runs standardized evaluation scenarios and exports CSV reports.
Usage:
  python run_benchmark.py --scenario open_arena --trials 3
  python run_benchmark.py --all-scenarios --trials 5
"""
import os
import argparse
import time
from benchmark.runner import BenchmarkRunner, AI_LABELS
from benchmark.metrics_collector import export_trials_to_csv, export_aggregates_to_csv


def print_comparison_table(aggregates):
    print("\n" + "=" * 105)
    print(f"{'AI ARCHITECTURE':<35} | {'TRIALS':<6} | {'WIN %':<7} | {'SURVIVAL (s)':<15} | {'DMG DEALT':<15} | {'RETREATS':<8}")
    print("=" * 105)
    for a in aggregates:
        surv_str = f"{a.mean_survival_time:.1f} ± {a.std_survival_time:.1f}"
        dmg_str = f"{a.mean_damage_dealt:.1f} ± {a.std_damage_dealt:.1f}"
        ret_str = f"{a.mean_retreats:.1f}"
        print(f"{a.ai_label:<35} | {a.trial_count:<6} | {a.npc_win_rate:>5.1f}% | {surv_str:<15} | {dmg_str:<15} | {ret_str:<8}")
    print("=" * 105 + "\n")


def main():
    parser = argparse.ArgumentParser(description="NPC AI Benchmark Runner CLI")
    parser.add_argument(
        "--scenario",
        type=str,
        default="open_arena",
        choices=["open_arena", "obstacle_arena", "corridors", "low_health", "dynamic_crossfire"],
        help="Standardized scenario ID to evaluate",
    )
    parser.add_argument("--trials", type=int, default=3, help="Number of trials per AI architecture")
    parser.add_argument("--output-dir", type=str, default="logs", help="Directory to save CSV reports")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    runner = BenchmarkRunner()

    print(f"\n[BENCHMARK] Starting evaluation: Scenario='{args.scenario}', Trials per AI={args.trials}")
    start_time = time.time()

    def on_progress(completed, total, label):
        pct = (completed / total) * 100
        print(f"  Progress: [{completed:02d}/{total:02d}] ({pct:5.1f}%) -> {label}")

    exp_data = runner.run_experiment(
        scenario_id=args.scenario,
        trials_per_ai=args.trials,
        on_progress=on_progress,
    )

    elapsed = time.time() - start_time
    print(f"\n[BENCHMARK] Completed {exp_data['completedTrials']} trials in {elapsed:.2f} seconds ({elapsed / max(1, exp_data['completedTrials']):.3f}s / trial)!")

    # Print summary table
    print_comparison_table(exp_data["rawAggregates"])

    # Export CSVs
    timestamp = int(time.time())
    trials_csv_path = os.path.join(args.output_dir, f"benchmark_{args.scenario}_trials_{timestamp}.csv")
    agg_csv_path = os.path.join(args.output_dir, f"benchmark_{args.scenario}_summary_{timestamp}.csv")

    with open(trials_csv_path, "w", encoding="utf-8") as f:
        f.write(exp_data["csvTrials"])
    with open(agg_csv_path, "w", encoding="utf-8") as f:
        f.write(exp_data["csvAggregates"])

    print(f"[EXPORT] Saved individual trial CSV: {trials_csv_path}")
    print(f"[EXPORT] Saved aggregated summary CSV: {agg_csv_path}")


if __name__ == "__main__":
    main()
