# Phase 3: Benchmark Runner, Standardized Scenarios, and Statistical Metrics

## Overview
Phase 3 implements an automated, reproducible benchmark evaluation suite across all 5 AI architectures. It runs independent of any frontend or browser rendering, executing trials in an accelerated headless mode ($\sim 18\text{ ms}$ per trial).

---

## 1. Components Implemented

### 1. `benchmark.automated_bot` ([benchmark/automated_bot.py](file:///home/dhanushbvijay/Desktop/AI_Project/benchmark/automated_bot.py))
- **Standardized Opponent Bot**:
  - Deterministic kiting dynamics (maintains $\sim 180\text{ px}$ combat spacing).
  - Tactical shockwave defense: triggers pulse damage and knockback when an NPC closes within $< 135\text{ px}$ and cooldown is available.
  - Perimeter boundary repulsion ($70\text{ px}$ margin) preventing corner trapping.
  - Obstacle crate collision avoidance.

### 2. `benchmark.metrics_collector` ([benchmark/metrics_collector.py](file:///home/dhanushbvijay/Desktop/AI_Project/benchmark/metrics_collector.py))
- **Tracked Metrics**:
  - `survival_time`: Duration before agent death or scenario timeout ($30-40\text{s}$).
  - `damage_dealt` & `damage_received`.
  - `attacks`: Debounced melee contacts ($\ge 0.4\text{s}$ cooldown).
  - `retreats`: Edge transitions into low-health flee or exhausted standoff states.
  - `distance_travelled`: Cumulative sub-pixel Euclidean distance.
  - `final_npc_health` & `final_player_health`.
  - `outcome`: `NPC Win`, `Player Win`, or `Timeout (Draw)`.
- **Statistical Aggregation**:
  - `mean`, sample standard deviation (`std`), `min`, `max` across all numeric metrics.
  - `npc_win_rate`, `player_win_rate`, and `draw_rate` percentages.
- **CSV Exporters**:
  - `export_trials_to_csv`: Detailed per-trial log (matching RFC 4180).
  - `export_aggregates_to_csv`: Comparative statistical summary table.

### 3. `benchmark.runner` ([benchmark/runner.py](file:///home/dhanushbvijay/Desktop/AI_Project/benchmark/runner.py))
- **Headless Benchmark Engine**:
  - Executes trials at atomic $\Delta t = 0.033\text{ s}$ without frame drops.
  - Deterministic seed sequence: $\text{seed} = 100000 + \text{trial} \times 37$.
  - Progress callbacks, batch trial execution, and cancellation support.

### 4. `run_benchmark.py` CLI ([run_benchmark.py](file:///home/dhanushbvijay/Desktop/AI_Project/run_benchmark.py))
- User-facing terminal CLI tool to execute trials and produce formatted summary tables:
  ```bash
  python3 run_benchmark.py --scenario open_arena --trials 3
  ```

---

## 2. Standardized Scenarios Evaluated

| Scenario ID | Name | Crates | Shrines | Time Limit | Primary Evaluation Focus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `open_arena` | Open Arena | 0 | 0 | 30s | Pure line-of-sight pursuit, sprint stamina, and direct combat. |
| `obstacle_arena` | Obstacle Arena | 6 pillars | 0 | 35s | Whisker raycasting and obstacle jitter avoidance. |
| `corridors` | Corridors & Choke Points | 5 walls | 0 | 40s | Navigation through narrow choke points and tight passages. |
| `low_health` | Low Health Survival Loop | 3 crates | 1 shrine | 35s | Prioritization of emergency health recovery vs combat. |
| `dynamic_crossfire` | Dynamic Crossfire & Flanking | 3 covers | 1 shrine | 40s | Broken line-of-sight flanking and corner ambushes. |

---

## 3. Test Suite Verification

Run all unit and integration tests across Phases 1, 2, and 3:
```bash
python3 -m unittest discover -s tests -v
```

Total tests: **43 passing (0 failures, 0 errors)**.
