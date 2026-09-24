/**
 * Experiment & Evaluation Dashboard Component.
 * Enables controlled, reproducible trial execution comparing Fuzzy Logic against
 * FSM, Behavior Tree, GOAP, and Utility AI. Displays side-by-side metric matrices,
 * raw trial tables, experiment history, and direct CSV export for Python/Pandas analysis.
 */

import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Play,
  Square,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Swords,
  ShieldAlert,
  Footprints,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  History,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Zap,
  Eye,
  MonitorPlay,
  Activity,
} from 'lucide-react';
import { GameEngine } from '../game/GameEngine';
import { ExperimentManager, ExperimentSpeed } from '../game/ExperimentManager';
import { AIType, ExperimentScenarioId, ExperimentRun, TrialResult, DebugVisualSettings } from '../types';
import { ALL_SCENARIOS, getExperimentScenario } from '../game/experimentScenarios';
import { GameCanvas } from './GameCanvas';

interface ExperimentViewProps {
  engine: GameEngine;
  experimentManager: ExperimentManager;
  debugSettings?: DebugVisualSettings;
  selectedNpcId?: string | null;
  onSelectNPC?: (id: string | null) => void;
}

export const ExperimentView: React.FC<ExperimentViewProps> = ({
  engine,
  experimentManager,
  debugSettings = {
    showRaycasts: true,
    showSteeringVectors: true,
    showTargetLines: true,
    showAIStateBadges: true,
    showCrateBounds: true,
    showHealthBars: true,
    showDetectionRadius: false,
    showPerformanceGraph: true,
  },
  selectedNpcId = null,
  onSelectNPC = () => {},
}) => {
  // Configuration State
  const [selectedAI, setSelectedAI] = useState<AIType | 'all'>('all');
  const [selectedScenario, setSelectedScenario] = useState<ExperimentScenarioId>('corridors');
  const [trialCount, setTrialCount] = useState<number>(10);
  const [speed, setSpeed] = useState<ExperimentSpeed>('fast');

  // Live Run State
  const [activeRun, setActiveRun] = useState<ExperimentRun | null>(experimentManager.activeRun);
  const [isRunning, setIsRunning] = useState<boolean>(experimentManager.isRunning);
  const [progressInfo, setProgressInfo] = useState<{
    completed: number;
    total: number;
    currentAI: string;
  } | null>(null);

  // View Filter / Inspection State
  const [viewedRun, setViewedRun] = useState<ExperimentRun | null>(
    experimentManager.activeRun || experimentManager.history[0] || null
  );
  const [showRawTrials, setShowRawTrials] = useState<boolean>(false);
  const [historyTab, setHistoryTab] = useState<'visual' | 'matrix' | 'history'>('matrix');

  // Subscribe to Experiment Manager updates
  useEffect(() => {
    experimentManager.onStateChange = (run, running) => {
      setActiveRun(run);
      setIsRunning(running);
      if (run) {
        setViewedRun(run);
      }
    };

    experimentManager.onProgress = (completed, total, currentAI) => {
      setProgressInfo({ completed, total, currentAI });
    };

    return () => {
      experimentManager.onStateChange = undefined;
      experimentManager.onProgress = undefined;
    };
  }, [experimentManager]);

  const handleStart = () => {
    if (speed === 'realtime') {
      setHistoryTab('visual');
    }
    experimentManager.startExperiment({
      aiType: selectedAI,
      scenarioId: selectedScenario,
      trialsPerAI: trialCount,
      speed,
    });
  };

  const handleCancel = () => {
    experimentManager.cancelExperiment();
  };

  const currentScenarioDetails = getExperimentScenario(selectedScenario, engine.width, engine.height);

  const displayedRun = activeRun || viewedRun;

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Left Column: Experiment Controls & Scenario Configuration */}
      <div className="w-full lg:w-84 xl:w-96 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto p-4 gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-white">Experiment Setup</h2>
              <p className="text-[11px] text-slate-400">Controlled Evaluation Protocols</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            P0 Evaluation
          </span>
        </div>

        {/* AI Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Architecture to Evaluate</span>
          </label>
          <select
            id="experiment-ai-select"
            value={selectedAI}
            onChange={(e) => setSelectedAI(e.target.value as AIType | 'all')}
            disabled={isRunning}
            className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
          >
            <option value="all">★ All 5 AI Architectures (Comparative Benchmark)</option>
            <option value="fuzzy">Fuzzy Logic AI (Continuous Rules)</option>
            <option value="behavior_tree">Behavior Tree AI (Hierarchical)</option>
            <option value="simple">Simple Decision AI (FSM)</option>
            <option value="goap">Goal-Oriented Action Planner (GOAP)</option>
            <option value="utility">Utility AI (Response Curves)</option>
          </select>
          <p className="text-[11px] text-slate-400">
            {selectedAI === 'all'
              ? 'Executes identical trials across all 5 architectures sequentially for direct comparison.'
              : `Focuses controlled benchmark trials strictly on ${experimentManager.getAILabel(selectedAI as AIType)}.`}
          </p>
        </div>

        {/* Scenario Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Predetermined Scenario</span>
          </label>
          <select
            id="experiment-scenario-select"
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value as ExperimentScenarioId)}
            disabled={isRunning}
            className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
          >
            {ALL_SCENARIOS.map((scId) => {
              const sc = getExperimentScenario(scId, engine.width, engine.height);
              return (
                <option key={scId} value={scId}>
                  {sc.name}
                </option>
              );
            })}
          </select>

          {/* Scenario Details Box */}
          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] space-y-1 text-slate-300">
            <p className="font-semibold text-cyan-300">{currentScenarioDetails.name}</p>
            <p className="text-slate-400 leading-relaxed">{currentScenarioDetails.description}</p>
            <div className="pt-1 flex flex-wrap gap-2 text-[10px] text-slate-400">
              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                Limit: {currentScenarioDetails.timeLimitSec}s
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                NPC HP: {currentScenarioDetails.npcInitialHealth}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                Player HP: {currentScenarioDetails.playerInitialHealth}
              </span>
            </div>
          </div>
        </div>

        {/* Number of Trials */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Trials per AI Architecture</span>
            </label>
            <span className="text-xs font-mono font-bold text-cyan-400">{trialCount}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 5, 10, 20, 30].map((num) => (
              <button
                key={num}
                id={`trial-count-btn-${num}`}
                onClick={() => setTrialCount(num)}
                disabled={isRunning}
                className={`py-1.5 rounded text-xs font-mono font-medium transition-all ${
                  trialCount === num
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                } disabled:opacity-50`}
              >
                {num}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Total trials to run:{' '}
            <strong className="text-white">
              {trialCount * (selectedAI === 'all' ? 5 : 1)}
            </strong>
          </p>
        </div>

        {/* Execution Speed */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>Execution Mode</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              id="speed-fast-btn"
              onClick={() => setSpeed('fast')}
              disabled={isRunning}
              className={`p-2 rounded-lg text-left text-xs border transition-all ${
                speed === 'fast'
                  ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-white">⚡ Accelerated</div>
              <div className="text-[10px] text-slate-400">~2-5 sec batch run</div>
            </button>
            <button
              id="speed-realtime-btn"
              onClick={() => setSpeed('realtime')}
              disabled={isRunning}
              className={`p-2 rounded-lg text-left text-xs border transition-all ${
                speed === 'realtime'
                  ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-semibold text-white">👁 Visual 1x</div>
              <div className="text-[10px] text-slate-400">Watch on arena canvas</div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          {!isRunning ? (
            <button
              id="run-experiment-btn"
              onClick={handleStart}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Run Controlled Experiment</span>
            </button>
          ) : (
            <button
              id="cancel-experiment-btn"
              onClick={handleCancel}
              className="w-full py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all cursor-pointer animate-pulse"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Cancel Experiment</span>
            </button>
          )}

          {/* Export CSV Button */}
          {displayedRun && displayedRun.results.length > 0 && (
            <button
              id="export-csv-btn"
              onClick={() => experimentManager.exportActiveRunCSV()}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Raw Trial Data (CSV)</span>
            </button>
          )}
        </div>

        {/* Live Progress Card */}
        {isRunning && progressInfo && (
          <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-xs space-y-2">
            <div className="flex items-center justify-between font-medium text-cyan-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Executing Trial...
              </span>
              <span className="font-mono">
                {progressInfo.completed} / {progressInfo.total}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-150"
                style={{
                  width: `${(progressInfo.completed / Math.max(1, progressInfo.total)) * 100}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">{progressInfo.currentAI}</p>
          </div>
        )}

        {/* Research Framing Context Banner */}
        <div className="mt-auto p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Academic Research Framing</span>
          </div>
          <p className="italic text-slate-400">
            &ldquo;How does fuzzy-logic decision making affect NPC behavior compared with alternative AI
            decision architectures?&rdquo;
          </p>
          <p className="text-[10px] text-slate-500 pt-1">
            Fair evaluation: zero randomness in initial conditions. All entities share exact starting health,
            spatial obstacles, and deterministic benchmark opponent interactions.
          </p>
        </div>
      </div>

      {/* Right Column: Comparative Results Dashboard */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Sub-Header Tabs */}
        <div className="h-11 shrink-0 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(isRunning && speed === 'realtime') || historyTab === 'visual' ? (
              <button
                id="tab-visual-arena-btn"
                onClick={() => setHistoryTab('visual')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  historyTab === 'visual'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-purple-300 hover:text-purple-100 hover:bg-slate-800'
                }`}
              >
                <MonitorPlay className="w-3.5 h-3.5 text-purple-200" />
                <span>Live Arena View</span>
                {isRunning && speed === 'realtime' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                )}
              </button>
            ) : null}
            <button
              id="tab-matrix-btn"
              onClick={() => setHistoryTab('matrix')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                historyTab === 'matrix'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Comparative Metrics Matrix</span>
            </button>
            <button
              id="tab-history-btn"
              onClick={() => setHistoryTab('history')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                historyTab === 'history'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Experiment History ({experimentManager.history.length})</span>
            </button>
          </div>

          {displayedRun && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400 text-[11px] hidden sm:inline font-mono">
                {displayedRun.scenarioName} &bull; {displayedRun.completedTrials} trials recorded
              </span>
              <button
                id="toggle-raw-trials-btn"
                onClick={() => setShowRawTrials(!showRawTrials)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 flex items-center gap-1"
              >
                {showRawTrials ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>{showRawTrials ? 'Hide Raw Trials' : 'Show Raw Trials'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {historyTab === 'visual' ? (
            /* Live Arena Visualization View */
            <div className="flex flex-col h-full space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <MonitorPlay className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Live Simulation Environment</span>
                      {isRunning && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center gap-1 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          RUNNING
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Visual 1x Real-Time Evaluation &bull; Scenario:{' '}
                      <span className="text-cyan-300 font-semibold">{currentScenarioDetails.name}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {progressInfo && (
                    <div className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300">
                      Trial {progressInfo.completed} / {progressInfo.total} &bull; {progressInfo.currentAI}
                    </div>
                  )}
                  <button
                    id="switch-to-matrix-btn"
                    onClick={() => setHistoryTab('matrix')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Results Matrix</span>
                  </button>
                </div>
              </div>

              {/* Arena Canvas Container */}
              <div className="flex-1 min-h-[440px] w-full rounded-xl overflow-hidden border border-slate-800 relative bg-slate-950 shadow-inner">
                <GameCanvas
                  engine={engine}
                  debugSettings={debugSettings}
                  selectedNpcId={selectedNpcId}
                  onSelectNPC={onSelectNPC}
                />
              </div>

              {/* Real-time trial telemetry footer */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span className="text-slate-400 text-[11px]">NPC Agent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="text-slate-400 text-[11px]">Player / Benchmark Opponent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-emerald-500/60" />
                    <span className="text-slate-400 text-[11px]">Healing Shrine</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-amber-700/60" />
                    <span className="text-slate-400 text-[11px]">Obstacle Crate</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Arena: {engine.width} &times; {engine.height} px &bull; Full physics & raycast steering
                </div>
              </div>
            </div>
          ) : historyTab === 'history' ? (
            /* History List */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  <span>Completed Experiment Runs</span>
                </h3>
                {experimentManager.history.length > 0 && (
                  <button
                    onClick={() => experimentManager.clearHistory()}
                    className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {experimentManager.history.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No experiments executed yet. Configure and click &ldquo;Run Controlled Experiment&rdquo;
                  to start your first trial run!
                </div>
              ) : (
                experimentManager.history.map((run, idx) => (
                  <div
                    key={run.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      viewedRun?.id === run.id
                        ? 'bg-slate-900 border-cyan-500/60 ring-1 ring-cyan-500/40'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white">
                            Experiment #{experimentManager.history.length - idx}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {run.scenarioName}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                              run.status === 'completed'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            }`}
                          >
                            {run.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {run.completedTrials} trials &bull;{' '}
                          {new Date(run.timestamp).toLocaleTimeString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setViewedRun(run);
                            setHistoryTab('matrix');
                          }}
                          className="px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Matrix</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => experimentManager.exportHistoryRunCSV(run)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer"
                          title="Export CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Matrix View */
            <>
              {!displayedRun || displayedRun.results.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <FlaskConical className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-white">No Active Experiment Data</h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    Select an AI architecture or run the full 5-way comparative benchmark on your desired
                    scenario. Click <strong>Run Controlled Experiment</strong> on the left to begin automated
                    data collection.
                  </p>
                </div>
              ) : (
                <>
                  {/* Results Overview Header Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-300 text-xs font-semibold">
                          {displayedRun.scenarioName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {displayedRun.completedTrials} trials recorded
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-white mt-1">
                        Quantitative Evaluation Matrix
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id="matrix-export-csv-btn"
                        onClick={() => experimentManager.exportActiveRunCSV()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV for Python / Pandas</span>
                      </button>
                    </div>
                  </div>

                  {/* Comparative Architecture Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                          <th className="py-3 px-4 min-w-[170px]">Metric / Parameter</th>
                          <th className="py-3 px-4 min-w-[130px] text-amber-300">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <span>FSM (Simple)</span>
                            </div>
                          </th>
                          <th className="py-3 px-4 min-w-[130px] text-purple-300">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-400" />
                              <span>Behavior Tree</span>
                            </div>
                          </th>
                          <th className="py-3 px-4 min-w-[140px] text-cyan-300 bg-cyan-950/30 border-x border-cyan-500/20">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-cyan-400" />
                              <span className="font-bold">Fuzzy Logic ★</span>
                            </div>
                          </th>
                          <th className="py-3 px-4 min-w-[130px] text-blue-300">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-400" />
                              <span>GOAP Planner</span>
                            </div>
                          </th>
                          <th className="py-3 px-4 min-w-[130px] text-rose-300">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-400" />
                              <span>Utility AI</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70 text-slate-200">
                        {/* Trials Recorded */}
                        <tr className="hover:bg-slate-800/30 font-mono">
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-400">
                            Completed Trials
                          </td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.simple?.trialCount || '—'}</td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.behavior_tree?.trialCount || '—'}</td>
                          <td className="py-2.5 px-4 font-bold text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {displayedRun.aggregates.fuzzy?.trialCount || '—'}
                          </td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.goap?.trialCount || '—'}</td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.utility?.trialCount || '—'}</td>
                        </tr>

                        {/* Survival Time */}
                        <tr className="hover:bg-slate-800/30 font-mono">
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            <span>Survival Time (s)</span>
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.simple?.meanSurvivalTime, displayedRun.aggregates.simple?.stdSurvivalTime)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.behavior_tree?.meanSurvivalTime, displayedRun.aggregates.behavior_tree?.stdSurvivalTime)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {formatMetric(displayedRun.aggregates.fuzzy?.meanSurvivalTime, displayedRun.aggregates.fuzzy?.stdSurvivalTime)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.goap?.meanSurvivalTime, displayedRun.aggregates.goap?.stdSurvivalTime)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.utility?.meanSurvivalTime, displayedRun.aggregates.utility?.stdSurvivalTime)}
                          </td>
                        </tr>

                        {/* Damage Dealt */}
                        <tr className="hover:bg-slate-800/30 font-mono">
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                            <Swords className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Damage Dealt</span>
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.simple?.meanDamageDealt, displayedRun.aggregates.simple?.stdDamageDealt)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.behavior_tree?.meanDamageDealt, displayedRun.aggregates.behavior_tree?.stdDamageDealt)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {formatMetric(displayedRun.aggregates.fuzzy?.meanDamageDealt, displayedRun.aggregates.fuzzy?.stdDamageDealt)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.goap?.meanDamageDealt, displayedRun.aggregates.goap?.stdDamageDealt)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.utility?.meanDamageDealt, displayedRun.aggregates.utility?.stdDamageDealt)}
                          </td>
                        </tr>

                        {/* Damage Received */}
                        <tr className="hover:bg-slate-800/30 font-mono">
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span>Damage Received</span>
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.simple?.meanDamageReceived, displayedRun.aggregates.simple?.stdDamageReceived)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.behavior_tree?.meanDamageReceived, displayedRun.aggregates.behavior_tree?.stdDamageReceived)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {formatMetric(displayedRun.aggregates.fuzzy?.meanDamageReceived, displayedRun.aggregates.fuzzy?.stdDamageReceived)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.goap?.meanDamageReceived, displayedRun.aggregates.goap?.stdDamageReceived)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.utility?.meanDamageReceived, displayedRun.aggregates.utility?.stdDamageReceived)}
                          </td>
                        </tr>

                        {/* Attacks */}
                        <tr className="hover:bg-slate-800/30 font-mono">
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-300">
                            Attack Contacts
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.simple?.meanAttacks, displayedRun.aggregates.simple?.stdAttacks)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.behavior_tree?.meanAttacks, displayedRun.aggregates.behavior_tree?.stdAttacks)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {formatMetric(displayedRun.aggregates.fuzzy?.meanAttacks, displayedRun.aggregates.fuzzy?.stdAttacks)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.goap?.meanAttacks, displayedRun.aggregates.goap?.stdAttacks)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.utility?.meanAttacks, displayedRun.aggregates.utility?.stdAttacks)}
                          </td>
                        </tr>

                        {/* Retreats */}
                        <tr className="hover:bg-slate-800/30 font-mono">
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-300">
                            Retreat Decisions
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.simple?.meanRetreats, displayedRun.aggregates.simple?.stdRetreats)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.behavior_tree?.meanRetreats, displayedRun.aggregates.behavior_tree?.stdRetreats)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {formatMetric(displayedRun.aggregates.fuzzy?.meanRetreats, displayedRun.aggregates.fuzzy?.stdRetreats)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.goap?.meanRetreats, displayedRun.aggregates.goap?.stdRetreats)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.utility?.meanRetreats, displayedRun.aggregates.utility?.stdRetreats)}
                          </td>
                        </tr>

                        {/* Distance Travelled */}
                        <tr className="hover:bg-slate-800/30 font-mono">
                          <td className="py-2.5 px-4 font-sans font-medium text-slate-300 flex items-center gap-1.5">
                            <Footprints className="w-3.5 h-3.5 text-amber-400" />
                            <span>Distance Travelled</span>
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.simple?.meanDistanceTravelled, displayedRun.aggregates.simple?.stdDistanceTravelled)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.behavior_tree?.meanDistanceTravelled, displayedRun.aggregates.behavior_tree?.stdDistanceTravelled)}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {formatMetric(displayedRun.aggregates.fuzzy?.meanDistanceTravelled, displayedRun.aggregates.fuzzy?.stdDistanceTravelled)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.goap?.meanDistanceTravelled, displayedRun.aggregates.goap?.stdDistanceTravelled)}
                          </td>
                          <td className="py-2.5 px-4">
                            {formatMetric(displayedRun.aggregates.utility?.meanDistanceTravelled, displayedRun.aggregates.utility?.stdDistanceTravelled)}
                          </td>
                        </tr>

                        {/* NPC Win Rate */}
                        <tr className="hover:bg-slate-800/30 font-mono bg-slate-950/40">
                          <td className="py-2.5 px-4 font-sans font-bold text-white">
                            NPC Win Rate (%)
                          </td>
                          <td className="py-2.5 px-4 font-bold text-amber-300">
                            {displayedRun.aggregates.simple ? `${displayedRun.aggregates.simple.npcWinRate}%` : '—'}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-purple-300">
                            {displayedRun.aggregates.behavior_tree ? `${displayedRun.aggregates.behavior_tree.npcWinRate}%` : '—'}
                          </td>
                          <td className="py-2.5 px-4 font-extrabold text-cyan-300 bg-cyan-950/30 border-x border-cyan-500/20">
                            {displayedRun.aggregates.fuzzy ? `${displayedRun.aggregates.fuzzy.npcWinRate}%` : '—'}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-blue-300">
                            {displayedRun.aggregates.goap ? `${displayedRun.aggregates.goap.npcWinRate}%` : '—'}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-rose-300">
                            {displayedRun.aggregates.utility ? `${displayedRun.aggregates.utility.npcWinRate}%` : '—'}
                          </td>
                        </tr>

                        {/* Player Win Rate */}
                        <tr className="hover:bg-slate-800/30 font-mono text-slate-400">
                          <td className="py-2.5 px-4 font-sans">Player Win Rate (%)</td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.simple ? `${displayedRun.aggregates.simple.playerWinRate}%` : '—'}</td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.behavior_tree ? `${displayedRun.aggregates.behavior_tree.playerWinRate}%` : '—'}</td>
                          <td className="py-2.5 px-4 font-medium text-cyan-300 bg-cyan-950/20 border-x border-cyan-500/20">
                            {displayedRun.aggregates.fuzzy ? `${displayedRun.aggregates.fuzzy.playerWinRate}%` : '—'}
                          </td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.goap ? `${displayedRun.aggregates.goap.playerWinRate}%` : '—'}</td>
                          <td className="py-2.5 px-4">{displayedRun.aggregates.utility ? `${displayedRun.aggregates.utility.playerWinRate}%` : '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Collapsible Raw Trial-by-Trial Data Table */}
                  {showRawTrials && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Raw Trial Records ({displayedRun.results.length} trials)</span>
                        </h4>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Ready for Python / Pandas / Matplotlib
                        </span>
                      </div>

                      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 font-mono text-[11px]">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400">
                            <tr>
                              <th className="py-2 px-3">#</th>
                              <th className="py-2 px-3">AI Architecture</th>
                              <th className="py-2 px-3">Seed</th>
                              <th className="py-2 px-3">Survival (s)</th>
                              <th className="py-2 px-3">Dmg Dealt</th>
                              <th className="py-2 px-3">Dmg Taken</th>
                              <th className="py-2 px-3">Attacks</th>
                              <th className="py-2 px-3">Retreats</th>
                              <th className="py-2 px-3">Outcome</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300">
                            {displayedRun.results.map((trial) => (
                              <tr key={`${trial.aiType}_${trial.trialNumber}`} className="hover:bg-slate-800/40">
                                <td className="py-1.5 px-3 text-slate-400">{trial.trialNumber}</td>
                                <td className="py-1.5 px-3 font-semibold text-white">{trial.aiLabel}</td>
                                <td className="py-1.5 px-3 text-slate-400">{trial.seed}</td>
                                <td className="py-1.5 px-3">{trial.survivalTime.toFixed(1)}</td>
                                <td className="py-1.5 px-3 text-emerald-400">{trial.damageDealt.toFixed(0)}</td>
                                <td className="py-1.5 px-3 text-rose-400">{trial.damageReceived.toFixed(0)}</td>
                                <td className="py-1.5 px-3">{trial.attacks}</td>
                                <td className="py-1.5 px-3">{trial.retreats}</td>
                                <td className="py-1.5 px-3">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      trial.npcWon
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                        : trial.playerWon
                                        ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                        : 'bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    {trial.outcome}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function formatMetric(meanVal?: number, stdVal?: number): string {
  if (meanVal === undefined || isNaN(meanVal)) return '—';
  if (stdVal !== undefined && !isNaN(stdVal) && stdVal > 0) {
    return `${meanVal} ± ${stdVal}`;
  }
  return `${meanVal}`;
}
