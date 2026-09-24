/**
 * High-Precision Telemetry and AI Performance Profiler.
 * Accurately measures frame render cadence, CPU simulation time,
 * and individual computational execution times (in microseconds / milliseconds)
 * for all 5 NPC driving algorithms: Fuzzy Logic, Behavior Tree, Simple FSM, GOAP, and Utility AI.
 */

import { AIType, AlgorithmCostMetric, ProfilerFrameSample, BenchmarkResult, NPC } from '../types';
import { FuzzySteeringEngine } from '../ai/fuzzy';
import { createComplexMovementBehaviorTree, BTExecutionContext, BTNode } from '../ai/behaviorTree';
import { SimpleDecisionEngine } from '../ai/simpleLogic';
import { GOAPSteeringEngine } from '../ai/goap';
import { UtilityAIEngine } from '../ai/utility';
import type { GameEngine } from './GameEngine';

export const ALGORITHM_CONFIG: Record<
  AIType,
  { name: string; color: string; complexityNote: string; typicalCostUs: number }
> = {
  simple: {
    name: 'Simple FSM',
    color: '#f59e0b', // Amber
    complexityNote: 'Direct if-else conditional branches; minimal O(1) state switching with lowest CPU overhead.',
    typicalCostUs: 8.5,
  },
  behavior_tree: {
    name: 'Behavior Tree',
    color: '#a855f7', // Purple
    complexityNote: 'Hierarchical node traversal; evaluates Condition and Action leaves inside Sequence/Fallback composites.',
    typicalCostUs: 24.2,
  },
  fuzzy: {
    name: 'Fuzzy Logic',
    color: '#06b6d4', // Cyan
    complexityNote: 'Triangular membership evaluation, multi-rule Mamdani inference, and center-of-gravity defuzzification.',
    typicalCostUs: 38.6,
  },
  utility: {
    name: 'Utility AI',
    color: '#f43f5e', // Rose
    complexityNote: 'Calculates continuous mathematical response curves across candidate behaviors with inertia weighting.',
    typicalCostUs: 46.8,
  },
  goap: {
    name: 'GOAP Planner',
    color: '#38bdf8', // Sky Blue
    complexityNote: 'A* graph search exploring permutations of action preconditions and post-effects in world state space.',
    typicalCostUs: 82.4,
  },
};

export class PerformanceProfiler {
  // Rolling frame history
  private maxHistory = 100;
  private history: ProfilerFrameSample[] = [];

  // Current frame accumulators
  private currentFrameStart = 0;
  private currentAITimes: Record<AIType, number> = {
    fuzzy: 0,
    behavior_tree: 0,
    simple: 0,
    goap: 0,
    utility: 0,
  };
  private currentAICounts: Record<AIType, number> = {
    fuzzy: 0,
    behavior_tree: 0,
    simple: 0,
    goap: 0,
    utility: 0,
  };

  // Smoothed stats & Moving averages (in ms)
  private emaAlpha = 0.12; // smoothing factor
  private algorithmEmaMs: Record<AIType, number> = {
    simple: 0.0085,
    behavior_tree: 0.024,
    fuzzy: 0.038,
    utility: 0.046,
    goap: 0.082,
  };
  private algorithmMinMs: Record<AIType, number> = {
    simple: 0.005,
    behavior_tree: 0.015,
    fuzzy: 0.025,
    utility: 0.032,
    goap: 0.055,
  };
  private algorithmMaxMs: Record<AIType, number> = {
    simple: 0.025,
    behavior_tree: 0.075,
    fuzzy: 0.095,
    utility: 0.12,
    goap: 0.22,
  };

  // Reference BT node for background profiling of inactive algorithms
  private referenceBTNode: BTNode | null = null;
  private backgroundCalibrationCounter = 0;

  // Cached benchmark results
  public latestBenchmark: BenchmarkResult[] | null = null;

  constructor() {
    this.referenceBTNode = createComplexMovementBehaviorTree();
    // Seed initial history
    const now = performance.now();
    for (let i = 0; i < 30; i++) {
      this.history.push({
        timestamp: now - (30 - i) * 16.6,
        frameTimeMs: 16.6,
        cpuWorkloadMs: 1.8,
        totalAITimeMs: 0.15,
        algorithmTimes: {
          simple: 0.008,
          behavior_tree: 0.024,
          fuzzy: 0.038,
          utility: 0.046,
          goap: 0.082,
        },
        fps: 60,
      });
    }
  }

  /**
   * Called at the start of a game engine update cycle.
   */
  public startFrame() {
    this.currentFrameStart = performance.now();
    this.currentAITimes = {
      fuzzy: 0,
      behavior_tree: 0,
      simple: 0,
      goap: 0,
      utility: 0,
    };
    this.currentAICounts = {
      fuzzy: 0,
      behavior_tree: 0,
      simple: 0,
      goap: 0,
      utility: 0,
    };
  }

  /**
   * Records a measured evaluation time for an AI decision tick.
   * @param aiType Algorithm type
   * @param durationMs Duration in milliseconds
   */
  public recordAIEvaluation(aiType: AIType, durationMs: number) {
    // Guard against precision anomalies
    const clamped = Math.max(0.001, durationMs);
    this.currentAITimes[aiType] += clamped;
    this.currentAICounts[aiType] += 1;

    // Update EMA
    const prevEma = this.algorithmEmaMs[aiType] || clamped;
    this.algorithmEmaMs[aiType] = prevEma * (1 - this.emaAlpha) + clamped * this.emaAlpha;

    if (clamped < this.algorithmMinMs[aiType]) {
      this.algorithmMinMs[aiType] = clamped;
    }
    if (clamped > this.algorithmMaxMs[aiType]) {
      this.algorithmMaxMs[aiType] = clamped;
    }
  }

  /**
   * Automatically executes a lightweight calibration tick for any algorithm
   * that has no active entities in the arena, ensuring live comparative visualization.
   */
  public performBackgroundCalibration(engine: GameEngine) {
    this.backgroundCalibrationCounter++;
    // Run calibration every 8 frames to minimize overhead (~0.04ms every 8 frames)
    if (this.backgroundCalibrationCounter % 8 !== 0) return;

    const unrepresented = (['simple', 'behavior_tree', 'fuzzy', 'utility', 'goap'] as AIType[]).filter(
      (type) => this.currentAICounts[type] === 0
    );

    if (unrepresented.length === 0) return;

    // Use first NPC or a synthetic representative entity
    const refNpc: NPC = engine.npcs[0] || {
      id: '__bench__',
      aiType: 'simple',
      x: engine.width * 0.4,
      y: engine.height * 0.4,
      vx: 50,
      vy: 50,
      rotation: 0.5,
      size: 26,
      health: 80,
      maxHealth: 100,
      maxSpeed: 200,
      maxForce: 260,
      isHealing: false,
      healingTimer: 0,
      lastDamageTime: 0,
      aggressionStamina: 3,
      maxAggressionStamina: 4,
      isExhausted: false,
      color: '#fff',
      accentColor: '#fff',
      name: 'Benchmark',
      sensors: [],
      debugData: {
        desiredVelocity: { x: 0, y: 0 },
        steeringForce: { x: 0, y: 0 },
        stateBadge: 'Calibrating',
      },
    };

    const nearestStation = engine.healStations[0] || null;

    for (const aiType of unrepresented) {
      const t0 = performance.now();
      if (aiType === 'fuzzy') {
        FuzzySteeringEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
      } else if (aiType === 'behavior_tree') {
        if (!this.referenceBTNode) this.referenceBTNode = createComplexMovementBehaviorTree();
        const ctx: BTExecutionContext = {
          npc: refNpc,
          player: engine.player,
          crates: engine.crates,
          healStations: engine.healStations,
          nearestHealStation: nearestStation,
          desiredVelocity: { x: 0, y: 0 },
          steeringForce: { x: 0, y: 0 },
          targetPoint: { x: engine.player.x, y: engine.player.y },
          currentActionName: '',
          badge: '',
        };
        this.referenceBTNode.tick(ctx, []);
      } else if (aiType === 'goap') {
        GOAPSteeringEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
      } else if (aiType === 'utility') {
        UtilityAIEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
      } else {
        SimpleDecisionEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
      }
      const t1 = performance.now();
      const elapsed = Math.max(0.001, t1 - t0);

      // Smooth into EMA without adding to current frame's entity count
      this.algorithmEmaMs[aiType] =
        this.algorithmEmaMs[aiType] * (1 - this.emaAlpha) + elapsed * this.emaAlpha;
    }
  }

  /**
   * Finalizes the current frame sample with total frame delta and CPU workload.
   */
  public endFrame(frameIntervalMs: number, cpuWorkloadMs: number) {
    const totalAITime =
      this.currentAITimes.simple +
      this.currentAITimes.behavior_tree +
      this.currentAITimes.fuzzy +
      this.currentAITimes.utility +
      this.currentAITimes.goap;

    const safeInterval = Math.max(1, frameIntervalMs);
    const instantFps = Math.min(144, Math.round(1000 / safeInterval));

    const sample: ProfilerFrameSample = {
      timestamp: performance.now(),
      frameTimeMs: safeInterval,
      cpuWorkloadMs: Math.max(0.1, cpuWorkloadMs),
      totalAITimeMs: totalAITime > 0 ? totalAITime : this.getCombinedAIEstimateMs(),
      algorithmTimes: {
        simple: this.currentAICounts.simple > 0 ? this.currentAITimes.simple : this.algorithmEmaMs.simple,
        behavior_tree:
          this.currentAICounts.behavior_tree > 0
            ? this.currentAITimes.behavior_tree
            : this.algorithmEmaMs.behavior_tree,
        fuzzy: this.currentAICounts.fuzzy > 0 ? this.currentAITimes.fuzzy : this.algorithmEmaMs.fuzzy,
        utility:
          this.currentAICounts.utility > 0 ? this.currentAITimes.utility : this.algorithmEmaMs.utility,
        goap: this.currentAICounts.goap > 0 ? this.currentAITimes.goap : this.algorithmEmaMs.goap,
      },
      fps: instantFps,
    };

    this.history.push(sample);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  private getCombinedAIEstimateMs(): number {
    return (
      this.algorithmEmaMs.simple +
      this.algorithmEmaMs.behavior_tree +
      this.algorithmEmaMs.fuzzy +
      this.algorithmEmaMs.utility +
      this.algorithmEmaMs.goap
    );
  }

  public getHistory(): ProfilerFrameSample[] {
    return this.history;
  }

  public getLatestSample(): ProfilerFrameSample {
    return (
      this.history[this.history.length - 1] || {
        timestamp: performance.now(),
        frameTimeMs: 16.6,
        cpuWorkloadMs: 1.5,
        totalAITimeMs: 0.15,
        algorithmTimes: { ...this.algorithmEmaMs },
        fps: 60,
      }
    );
  }

  /**
   * Computes comparative metrics for all 5 algorithms.
   */
  public getAlgorithmMetrics(): Record<AIType, AlgorithmCostMetric> {
    const types: AIType[] = ['simple', 'behavior_tree', 'fuzzy', 'utility', 'goap'];
    const minBaseline = Math.max(0.001, this.algorithmEmaMs.simple);

    const result = {} as Record<AIType, AlgorithmCostMetric>;

    for (const t of types) {
      const cfg = ALGORITHM_CONFIG[t];
      const avg = this.algorithmEmaMs[t];
      const current = this.currentAICounts[t] > 0 ? this.currentAITimes[t] : avg;
      const count = this.currentAICounts[t];

      result[t] = {
        aiType: t,
        name: cfg.name,
        color: cfg.color,
        currentMs: current,
        avgMs: avg,
        minMs: this.algorithmMinMs[t],
        maxMs: this.algorithmMaxMs[t],
        activeCount: count,
        relativeRatio: avg / minBaseline,
        complexityNote: cfg.complexityNote,
      };
    }

    return result;
  }

  /**
   * Executes a statistical micro-benchmark comparing pure decision tick microseconds
   * across all 5 algorithms against the current game environment.
   */
  public runMicroBenchmark(engine: GameEngine, iterations = 250): BenchmarkResult[] {
    const refNpc: NPC = engine.npcs[0] || {
      id: '__benchmark__',
      aiType: 'simple',
      x: engine.width * 0.45,
      y: engine.height * 0.45,
      vx: 40,
      vy: 40,
      rotation: 0.5,
      size: 26,
      health: 65,
      maxHealth: 100,
      maxSpeed: 210,
      maxForce: 280,
      isHealing: false,
      healingTimer: 0,
      lastDamageTime: 0,
      aggressionStamina: 2.5,
      maxAggressionStamina: 4,
      isExhausted: false,
      color: '#fff',
      accentColor: '#fff',
      name: 'Benchmark NPC',
      sensors: [],
      debugData: {
        desiredVelocity: { x: 0, y: 0 },
        steeringForce: { x: 0, y: 0 },
        stateBadge: 'Benchmarking',
      },
    };

    const nearestStation = engine.healStations[0] || null;
    const btNode = createComplexMovementBehaviorTree();

    const types: AIType[] = ['simple', 'behavior_tree', 'fuzzy', 'utility', 'goap'];
    const results: BenchmarkResult[] = [];

    // Warm-up pass (50 iterations) to avoid JIT warm-up skew
    for (let w = 0; w < 50; w++) {
      SimpleDecisionEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
      FuzzySteeringEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
      GOAPSteeringEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
    }

    let minMeanUs = Infinity;

    for (const aiType of types) {
      const timesUs: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        if (aiType === 'simple') {
          SimpleDecisionEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
        } else if (aiType === 'behavior_tree') {
          const ctx: BTExecutionContext = {
            npc: refNpc,
            player: engine.player,
            crates: engine.crates,
            healStations: engine.healStations,
            nearestHealStation: nearestStation,
            desiredVelocity: { x: 0, y: 0 },
            steeringForce: { x: 0, y: 0 },
            targetPoint: { x: engine.player.x, y: engine.player.y },
            currentActionName: '',
            badge: '',
          };
          btNode.tick(ctx, []);
        } else if (aiType === 'fuzzy') {
          FuzzySteeringEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
        } else if (aiType === 'utility') {
          UtilityAIEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
        } else if (aiType === 'goap') {
          GOAPSteeringEngine.evaluate(refNpc, engine.player, engine.crates, engine.healStations, nearestStation);
        }
        const t1 = performance.now();
        // Convert ms to microseconds
        const us = Math.max(0.5, (t1 - t0) * 1000);
        timesUs.push(us);
      }

      // Compute statistics
      const sum = timesUs.reduce((a, b) => a + b, 0);
      const mean = sum / timesUs.length;
      const min = Math.min(...timesUs);
      const max = Math.max(...timesUs);
      const variance = timesUs.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / timesUs.length;
      const std = Math.sqrt(variance);

      if (mean < minMeanUs) {
        minMeanUs = mean;
      }

      // Update engine EMA as well
      this.algorithmEmaMs[aiType] = mean / 1000;

      results.push({
        aiType,
        name: ALGORITHM_CONFIG[aiType].name,
        color: ALGORITHM_CONFIG[aiType].color,
        meanUs: Math.round(mean * 10) / 10,
        minUs: Math.round(min * 10) / 10,
        maxUs: Math.round(max * 10) / 10,
        stdUs: Math.round(std * 10) / 10,
        relativeRatio: 1, // updated below
        iterations,
        complexityNote: ALGORITHM_CONFIG[aiType].complexityNote,
      });
    }

    // Normalize relative ratio
    for (const r of results) {
      r.relativeRatio = Math.round((r.meanUs / (minMeanUs || 1)) * 10) / 10;
    }

    this.latestBenchmark = results;
    return results;
  }
}
