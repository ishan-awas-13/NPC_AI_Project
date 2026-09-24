/**
 * Experiment Manager: Orchestrates controlled, reproducible evaluation trials,
 * gathers metrics across all 5 AI architectures, computes aggregates,
 * and handles trial progression and cancellation.
 */

import { GameEngine } from './GameEngine';
import {
  AIType,
  ExperimentScenarioId,
  ExperimentScenarioConfig,
  TrialResult,
  AggregatedAIMetrics,
  ExperimentRun,
} from '../types';
import { getExperimentScenario } from './experimentScenarios';
import { computeAggregates, exportTrialsToCSV, downloadCSV } from './TrialMetricsCollector';

export type ExperimentSpeed = 'fast' | 'realtime';

export interface ExperimentConfig {
  aiType: AIType | 'all';
  scenarioId: ExperimentScenarioId;
  trialsPerAI: number;
  speed: ExperimentSpeed;
}

export class ExperimentManager {
  private engine: GameEngine;
  public activeRun: ExperimentRun | null = null;
  public history: ExperimentRun[] = [];
  public isRunning = false;
  private cancelRequested = false;
  private animationHandle: number | null = null;
  private timeoutHandle: number | null = null;

  // Listeners for UI state reactivity
  public onStateChange?: (run: ExperimentRun | null, isRunning: boolean) => void;
  public onProgress?: (completed: number, total: number, currentAI: string) => void;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public async startExperiment(config: ExperimentConfig) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.cancelRequested = false;

    const scenario = getExperimentScenario(config.scenarioId, this.engine.width, this.engine.height);

    const aiList: AIType[] =
      config.aiType === 'all'
        ? ['simple', 'behavior_tree', 'fuzzy', 'goap', 'utility']
        : [config.aiType];

    const totalTrials = aiList.length * config.trialsPerAI;
    const experimentId = `exp_${Date.now()}`;

    const newRun: ExperimentRun = {
      id: experimentId,
      timestamp: Date.now(),
      scenarioId: config.scenarioId,
      scenarioName: scenario.name,
      aiType: config.aiType,
      trialsPerAI: config.trialsPerAI,
      totalTrials,
      completedTrials: 0,
      results: [],
      aggregates: {
        fuzzy: null,
        behavior_tree: null,
        simple: null,
        goap: null,
        utility: null,
      },
      status: 'running',
    };

    this.activeRun = newRun;
    this.notify();

    try {
      let completedSoFar = 0;

      for (const currentAi of aiList) {
        if (this.cancelRequested) break;

        for (let trialIdx = 1; trialIdx <= config.trialsPerAI; trialIdx++) {
          if (this.cancelRequested) break;

          completedSoFar++;
          if (this.onProgress) {
            const aiLabel = this.getAILabel(currentAi);
            this.onProgress(completedSoFar, totalTrials, `${aiLabel} (Trial ${trialIdx}/${config.trialsPerAI})`);
          }

          // Deterministic seed generation based on trial index
          const seed = 100000 + trialIdx * 37;

          const trialResult = await this.runSingleTrial(
            scenario,
            currentAi,
            experimentId,
            trialIdx,
            seed,
            config.speed
          );

          if (this.cancelRequested) break;

          newRun.results.push(trialResult);
          newRun.completedTrials = newRun.results.length;

          // Recompute aggregates for this AI
          const aiTrials = newRun.results.filter((r) => r.aiType === currentAi);
          newRun.aggregates[currentAi] = computeAggregates(
            currentAi,
            this.getAILabel(currentAi),
            aiTrials
          );

          this.notify();
        }
      }

      newRun.status = this.cancelRequested ? 'cancelled' : 'completed';
    } catch (err) {
      console.error('Experiment execution error:', err);
      newRun.status = 'cancelled';
    } finally {
      this.isRunning = false;
      this.engine.endExperimentMode();

      // Store in history
      if (newRun.results.length > 0) {
        this.history = [newRun, ...this.history.slice(0, 19)]; // keep up to 20 runs
      }
      this.notify();
    }
  }

  public cancelExperiment() {
    if (!this.isRunning) return;
    this.cancelRequested = true;
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.engine.endExperimentMode();
    this.isRunning = false;
    if (this.activeRun) {
      this.activeRun.status = 'cancelled';
    }
    this.notify();
  }

  private runSingleTrial(
    scenario: ExperimentScenarioConfig,
    aiType: AIType,
    experimentId: string,
    trialNumber: number,
    seed: number,
    speed: ExperimentSpeed
  ): Promise<TrialResult> {
    return new Promise((resolve) => {
      this.engine.setupExperimentTrial(scenario, aiType, experimentId, trialNumber, seed);

      this.engine.onTrialComplete = (result: TrialResult) => {
        if (this.animationHandle !== null) {
          cancelAnimationFrame(this.animationHandle);
          this.animationHandle = null;
        }
        if (this.timeoutHandle !== null) {
          clearTimeout(this.timeoutHandle);
          this.timeoutHandle = null;
        }
        resolve(result);
      };

      if (speed === 'fast') {
        // Fast accelerated execution: step in batches of micro-ticks
        const runFastBatch = () => {
          if (this.cancelRequested) return;

          // Step 12 frames per chunk (equivalent to ~200ms of sim per browser tick)
          const stepsPerTick = 12;
          const dt = 1 / 60;

          for (let i = 0; i < stepsPerTick; i++) {
            if (!this.engine.activeTrialTracker) break;
            this.engine.stepFixed(dt);
          }

          if (this.engine.activeTrialTracker && !this.cancelRequested) {
            this.timeoutHandle = window.setTimeout(runFastBatch, 4);
          }
        };

        this.timeoutHandle = window.setTimeout(runFastBatch, 4);
      } else {
        // Real-time visual execution is handled by normal GameCanvas render loop
        // The engine.onTrialComplete callback resolves the promise when trial finishes.
      }
    });
  }

  public exportActiveRunCSV() {
    if (!this.activeRun || this.activeRun.results.length === 0) return;
    const csv = exportTrialsToCSV(this.activeRun.results);
    const filename = `npc_ai_experiment_${this.activeRun.scenarioId}_${Date.now()}.csv`;
    downloadCSV(filename, csv);
  }

  public exportHistoryRunCSV(run: ExperimentRun) {
    if (run.results.length === 0) return;
    const csv = exportTrialsToCSV(run.results);
    const filename = `npc_ai_experiment_${run.scenarioId}_${run.id}.csv`;
    downloadCSV(filename, csv);
  }

  public clearHistory() {
    this.history = [];
    this.notify();
  }

  private notify() {
    if (this.onStateChange) {
      this.onStateChange(this.activeRun, this.isRunning);
    }
  }

  public getAILabel(aiType: AIType): string {
    switch (aiType) {
      case 'fuzzy':
        return 'Fuzzy Logic';
      case 'behavior_tree':
        return 'Behavior Tree';
      case 'simple':
        return 'Simple (FSM)';
      case 'goap':
        return 'GOAP Planner';
      case 'utility':
        return 'Utility AI';
    }
  }
}
