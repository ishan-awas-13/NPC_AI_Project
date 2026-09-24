/**
 * Real-Time Telemetry & AI Computational Cost Profiler.
 * Renders in the bottom corner of the canvas to visualize frame time,
 * overall AI processing load, and side-by-side computational cost differences
 * between Fuzzy Logic, Behavior Trees, Simple FSM, GOAP, and Utility AI.
 */

import React, { useState, useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { AIType, AlgorithmCostMetric, BenchmarkResult } from '../types';
import { ALGORITHM_CONFIG } from '../game/PerformanceProfiler';
import {
  Activity,
  Cpu,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Sparkles,
  BarChart3,
  HelpCircle,
  Play,
  RotateCcw,
  Sliders,
  Layers,
  CheckCircle2,
  X,
} from 'lucide-react';

interface PerformanceGraphProps {
  engine: GameEngine;
  onClose?: () => void;
}

type ViewMode = 'combined' | 'multi_ai';
type ScaleMode = 'auto' | 'target_60' | 'target_30';

export const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ engine, onClose }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('target_60');
  const [showBenchmarkModal, setShowBenchmarkModal] = useState<boolean>(false);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResult[] | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Live snapshot state updated every few animation frames for UI text
  const [telemetry, setTelemetry] = useState<{
    fps: number;
    frameTimeMs: number;
    cpuWorkloadMs: number;
    totalAITimeMs: number;
    metrics: Record<AIType, AlgorithmCostMetric>;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Periodic UI update (5 times per second for badges and table, graph canvas renders every frame)
  useEffect(() => {
    const timer = setInterval(() => {
      const sample = engine.profiler.getLatestSample();
      const metrics = engine.profiler.getAlgorithmMetrics();
      setTelemetry({
        fps: sample.fps,
        frameTimeMs: sample.frameTimeMs,
        cpuWorkloadMs: sample.cpuWorkloadMs,
        totalAITimeMs: sample.totalAITimeMs,
        metrics,
      });
    }, 180);

    return () => clearInterval(timer);
  }, [engine]);

  // Graph Canvas Rendering Loop (60 FPS smooth rendering)
  useEffect(() => {
    let animId: number;

    const renderGraph = () => {
      const canvas = canvasRef.current;
      if (canvas && isExpanded) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          const w = rect.width;
          const h = rect.height;

          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
          }

          ctx.save();
          ctx.scale(dpr, dpr);
          drawTelemetryGraph(ctx, w, h, engine, viewMode, scaleMode);
          ctx.restore();
        }
      }
      animId = requestAnimationFrame(renderGraph);
    };

    animId = requestAnimationFrame(renderGraph);
    return () => cancelAnimationFrame(animId);
  }, [engine, isExpanded, viewMode, scaleMode]);

  // Run benchmark handler
  const handleRunBenchmark = () => {
    setIsBenchmarking(true);
    // Execute after brief delay so UI shows loading state
    setTimeout(() => {
      const results = engine.profiler.runMicroBenchmark(engine, 300);
      setBenchmarkData(results);
      setIsBenchmarking(false);
      setShowBenchmarkModal(true);
    }, 40);
  };

  const metrics = telemetry?.metrics || engine.profiler.getAlgorithmMetrics();
  const sample = telemetry || engine.profiler.getLatestSample();
  const frameTime = sample?.frameTimeMs || 16.6;
  const fps = sample?.fps || 60;
  const totalAIUs = Math.round((sample?.totalAITimeMs || 0.1) * 1000);
  const totalAIMs = (sample?.totalAITimeMs || 0.1).toFixed(2);
  const frameBudgetPct = (((sample?.totalAITimeMs || 0.1) / 16.66) * 100).toFixed(1);

  // Minimized Widget View (floating bottom-right pill)
  if (!isExpanded) {
    return (
      <div
        id="performance-telemetry-widget"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(true);
        }}
        className="pointer-events-auto absolute bottom-3 right-3 z-30 bg-slate-950/90 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-2xl text-xs flex items-center gap-2.5 cursor-pointer transition-all duration-150 select-none group"
        title="Click to expand real-time frame time and AI computational cost profiler graph"
      >
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Activity className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="font-mono font-bold text-white">{fps} FPS</span>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1 text-slate-300 font-mono">
          <span className="text-slate-400">Frame:</span>
          <span
            className={`font-semibold ${
              frameTime <= 17 ? 'text-emerald-400' : frameTime <= 34 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {frameTime.toFixed(1)}ms
          </span>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1 text-purple-300 font-mono">
          <span className="text-slate-400">AI Load:</span>
          <span className="font-semibold text-purple-400">{totalAIUs}μs</span>
        </div>
        <div className="ml-1 pl-1.5 border-l border-slate-700 text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 text-[11px]">
          <span>Expand</span>
          <Maximize2 className="w-3 h-3" />
        </div>
      </div>
    );
  }

  // Expanded Telemetry & Computational Cost Widget
  return (
    <div
      id="performance-telemetry-widget"
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute bottom-3 right-3 z-30 w-[350px] max-w-[calc(100vw-24px)] bg-slate-950/95 border border-slate-800 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden select-none text-xs font-sans animate-in fade-in zoom-in-95 duration-150 flex flex-col"
    >
      {/* Top Header & Telemetry Badges */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-[11px] text-white tracking-wide uppercase flex items-center gap-1.5">
              <span>AI Profiler & Frame Graph</span>
            </h3>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRunBenchmark()}
            disabled={isBenchmarking}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 font-medium border border-slate-700 hover:border-cyan-500/40 transition-colors flex items-center gap-1"
            title="Execute 300-cycle high-precision stress test across all 5 AI algorithms"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{isBenchmarking ? 'Testing...' : 'Benchmark'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Minimize to floating pill"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
              title="Close profiler graph"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Status Badges Bar */}
      <div className="grid grid-cols-3 gap-1 px-3 py-1.5 bg-slate-900/50 border-b border-slate-800/80 text-[11px] font-mono">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400">FRAME CADENCE</span>
          <span
            className={`font-bold ${
              frameTime <= 17.5
                ? 'text-emerald-400'
                : frameTime <= 34
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {frameTime.toFixed(1)}ms ({fps} FPS)
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400">AI TICK LOAD</span>
          <span className="font-bold text-purple-400">
            {totalAIUs} μs <span className="text-[10px] text-slate-400">({totalAIMs}ms)</span>
          </span>
        </div>

        <div className="flex flex-col text-right">
          <span className="text-[10px] text-slate-400">BUDGET (16.6ms)</span>
          <span className="font-bold text-cyan-300">{frameBudgetPct}%</span>
        </div>
      </div>

      {/* Graph Mode & Scale Controls */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between text-[10px]">
        {/* View Mode Toggle */}
        <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800">
          <button
            onClick={() => setViewMode('combined')}
            className={`px-2 py-0.5 rounded transition-all font-medium ${
              viewMode === 'combined'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Frame & Total AI
          </button>
          <button
            onClick={() => setViewMode('multi_ai')}
            className={`px-2 py-0.5 rounded transition-all font-medium ${
              viewMode === 'multi_ai'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            5-AI Cost Curves
          </button>
        </div>

        {/* Scale Mode Toggle */}
        <div className="flex items-center gap-1 text-slate-400 font-mono">
          <span>Scale:</span>
          <select
            value={scaleMode}
            onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
            className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-cyan-500"
          >
            <option value="target_60">16.6ms (60 FPS)</option>
            <option value="target_30">33.3ms (30 FPS)</option>
            <option value="auto">Auto-Fit</option>
          </select>
        </div>
      </div>

      {/* Main Rolling Graph Canvas */}
      <div className="px-3 py-1">
        <div className="relative w-full h-24 bg-slate-950 rounded-lg border border-slate-800/90 overflow-hidden shadow-inner">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </div>

      {/* Computational Cost Hierarchy (Comparison Matrix) */}
      <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-900/40 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
          <span>ALGORITHM COMPUTATIONAL COST</span>
          <span className="font-mono text-cyan-400">RATIO VS SIMPLE</span>
        </div>

        {/* Algorithms Cost Bars */}
        <div className="space-y-1">
          {(['goap', 'utility', 'fuzzy', 'behavior_tree', 'simple'] as AIType[]).map((type) => {
            const m = metrics[type];
            if (!m) return null;
            const costUs = Math.round(m.avgMs * 1000 * 10) / 10;
            // Ratio relative to Simple FSM
            const simpleCostUs = Math.max(1, (metrics.simple?.avgMs || 0.008) * 1000);
            const ratio = (costUs / simpleCostUs).toFixed(1);
            // Normalized bar width (up to 100% based on GOAP ~85us)
            const maxCost = Math.max(80, (metrics.goap?.avgMs || 0.082) * 1000);
            const barWidthPct = Math.min(100, Math.max(6, (costUs / maxCost) * 100));

            return (
              <div
                key={type}
                className="group relative flex items-center justify-between text-[11px] hover:bg-slate-800/40 px-1 py-0.5 rounded transition-colors"
                onMouseEnter={() => setActiveTooltip(type)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                {/* Left: Indicator dot & Algorithm Name */}
                <div className="flex items-center gap-1.5 w-28 shrink-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="font-medium text-slate-200 truncate">{m.name}</span>
                  {m.activeCount > 0 && (
                    <span className="text-[9px] px-1 py-0.2 bg-slate-800 rounded font-mono text-slate-400 shrink-0">
                      {m.activeCount}x
                    </span>
                  )}
                </div>

                {/* Center: Relative Proportional Bar */}
                <div className="flex-1 mx-2 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60 p-0.2">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${barWidthPct}%`,
                      backgroundColor: m.color,
                      opacity: 0.85,
                    }}
                  />
                </div>

                {/* Right: Exact Microseconds & Relative Multiplier */}
                <div className="w-20 text-right font-mono flex items-center justify-end gap-1.5 shrink-0">
                  <span className="text-slate-300 font-semibold">{costUs}μs</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                      type === 'simple'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-600/30'
                        : type === 'goap'
                        ? 'bg-sky-950/60 text-sky-300 border border-sky-600/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {type === 'simple' ? '1.0×' : `${ratio}×`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Tooltip / Architectural Explanation Callout */}
        <div className="mt-1 p-1.5 bg-slate-950/80 rounded border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
          {activeTooltip ? (
            <p>
              <strong className="text-white">{ALGORITHM_CONFIG[activeTooltip as AIType]?.name}:</strong>{' '}
              {ALGORITHM_CONFIG[activeTooltip as AIType]?.complexityNote}
            </p>
          ) : (
            <p className="text-slate-400">
              <strong className="text-cyan-300">Cost Insight:</strong> GOAP uses A* graph search over actions (~8–10× cost of FSM). Simple FSM executes lowest (~8μs) but exhibits rigid transitions.
            </p>
          )}
        </div>
      </div>

      {/* Benchmark Results Modal / Overlay */}
      {showBenchmarkModal && benchmarkData && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md p-3 z-40 flex flex-col justify-between animate-in fade-in duration-150">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>AI Micro-Benchmark (300 Iterations)</span>
              </div>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[10px] text-slate-400 mt-1 mb-2">
              Evaluated on live arena obstacle geometry:
            </p>

            <div className="space-y-1.5">
              {benchmarkData.map((b) => (
                <div
                  key={b.aiType}
                  className="bg-slate-900/80 border border-slate-800 rounded p-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.name}
                    </span>
                    <span className="font-mono text-cyan-300 font-bold">
                      {b.meanUs} μs <span className="text-[10px] text-slate-400">(±{b.stdUs}μs)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                    <span>Min: {b.minUs}μs | Max: {b.maxUs}μs</span>
                    <span className="text-amber-400 font-semibold">{b.relativeRatio}× baseline</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowBenchmarkModal(false)}
            className="w-full mt-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium text-xs shadow"
          >
            Close Benchmark
          </button>
        </div>
      )}
    </div>
  );
};

// Canvas Graph Drawing Helper
function drawTelemetryGraph(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  engine: GameEngine,
  viewMode: ViewMode,
  scaleMode: ScaleMode
) {
  const history = engine.profiler.getHistory();
  if (history.length < 2) return;

  // Clear canvas
  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 0, width, height);

  const paddingLeft = 32;
  const paddingRight = 8;
  const paddingTop = 12;
  const paddingBottom = 16;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  if (viewMode === 'combined') {
    // Mode 1: Frame Time (0 - 20/35ms) + Total AI Processing Load (Secondary scaled curve)
    let maxMs = 20;
    if (scaleMode === 'target_60') maxMs = 22;
    else if (scaleMode === 'target_30') maxMs = 38;
    else {
      // Auto-fit
      const highest = Math.max(...history.map((h) => h.frameTimeMs));
      maxMs = Math.max(18, Math.min(60, highest * 1.2));
    }

    // Draw horizontal grid lines & labels
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';

    // 0ms baseline
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // 16.6ms Target (60 FPS green dashed reference)
    const target60Y = height - paddingBottom - (16.66 / maxMs) * plotH;
    if (target60Y >= paddingTop) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, target60Y);
      ctx.lineTo(width - paddingRight, target60Y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#34d399';
      ctx.fillText('16.6ms', paddingLeft - 4, target60Y + 3);
    }

    // 33.3ms Target (30 FPS red dashed reference, if in range)
    const target30Y = height - paddingBottom - (33.33 / maxMs) * plotH;
    if (target30Y >= paddingTop) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, target30Y);
      ctx.lineTo(width - paddingRight, target30Y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f87171';
      ctx.fillText('33ms', paddingLeft - 4, target30Y + 3);
    }

    // 1. Plot Frame Time Area & Line (Cyan / Sky)
    ctx.beginPath();
    history.forEach((sample, idx) => {
      const x = paddingLeft + (idx / (history.length - 1)) * plotW;
      const val = Math.min(maxMs, sample.frameTimeMs);
      const y = height - paddingBottom - (val / maxMs) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Area under Frame Time
    ctx.save();
    const lastX = paddingLeft + plotW;
    ctx.lineTo(lastX, height - paddingBottom);
    ctx.lineTo(paddingLeft, height - paddingBottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.01)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Frame Time Stroke
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.75;
    ctx.stroke();

    // 2. Plot Total AI Processing Load (Purple Line with highlighted microsecond scale)
    // To ensure microsecond AI variations are visually distinct and not flattened at 0.1ms:
    // Scale AI load on 0 - 0.5ms (or 0 - 1.0ms) mapped across 60% of graph height
    const maxAIMs = 0.5;
    ctx.beginPath();
    history.forEach((sample, idx) => {
      const x = paddingLeft + (idx / (history.length - 1)) * plotW;
      const aiVal = Math.min(maxAIMs, sample.totalAITimeMs);
      const y = height - paddingBottom - (aiVal / maxAIMs) * (plotH * 0.7);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#c084fc'; // Vibrant purple
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Latest points pulsing dots
    const latest = history[history.length - 1];
    if (latest) {
      const lx = paddingLeft + plotW;
      const lyFrame = height - paddingBottom - (Math.min(maxMs, latest.frameTimeMs) / maxMs) * plotH;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(lx, lyFrame, 3, 0, Math.PI * 2);
      ctx.fill();

      const lyAI = height - paddingBottom - (Math.min(maxAIMs, latest.totalAITimeMs) / maxAIMs) * (plotH * 0.7);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(lx, lyAI, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Legend at Top
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#38bdf8';
    ctx.fillText('■ Frame Time', paddingLeft + 4, paddingTop - 2);

    ctx.fillStyle = '#c084fc';
    ctx.fillText('■ Total AI Load', paddingLeft + 84, paddingTop - 2);
  } else {
    // Mode 2: Multi-AI Cost Curves (All 5 algorithms plotted simultaneously in microseconds)
    const types: AIType[] = ['goap', 'utility', 'fuzzy', 'behavior_tree', 'simple'];
    const maxUs = 120; // 0 - 120 μs scale

    // Horizontal guideline for 50μs and 100μs
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';

    [30, 60, 90].forEach((level) => {
      const y = height - paddingBottom - (level / maxUs) * plotH;
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.25)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#64748b';
      ctx.fillText(`${level}μs`, paddingLeft - 4, y + 3);
    });

    // Plot each algorithm's trace line
    types.forEach((type) => {
      const cfg = ALGORITHM_CONFIG[type];
      ctx.beginPath();
      history.forEach((sample, idx) => {
        const x = paddingLeft + (idx / (history.length - 1)) * plotW;
        const valMs = sample.algorithmTimes[type] || 0.01;
        const valUs = Math.min(maxUs, valMs * 1000);
        const y = height - paddingBottom - (valUs / maxUs) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Legend at top
    ctx.font = 'bold 8.5px system-ui, sans-serif';
    ctx.textAlign = 'left';
    let legX = paddingLeft + 2;
    types.forEach((t) => {
      const cfg = ALGORITHM_CONFIG[t];
      ctx.fillStyle = cfg.color;
      ctx.fillText(cfg.name.split(' ')[0], legX, paddingTop - 2);
      legX += 54;
    });
  }
}
