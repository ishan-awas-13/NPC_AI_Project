/**
 * Main Application Component for the NPC Steering & Driving AI Demo.
 * Orchestrates simulation engine, canvas rendering, controls toolbar,
 * and live AI Inspector panel.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameCanvas } from './components/GameCanvas';
import { ControlsToolbar } from './components/ControlsToolbar';
import { GameHUD } from './components/GameHUD';
import { AIDebugPanel } from './components/AIDebugPanel';
import { ExperimentManager } from './game/ExperimentManager';
import { ExperimentView } from './components/ExperimentView';
import { DebugVisualSettings, CratePreset, AIType } from './types';
import {
  BrainCircuit,
  Sliders,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  Shield,
  Zap,
  Gamepad2,
  FlaskConical,
} from 'lucide-react';

export default function App() {
  const engine = useMemo(() => new GameEngine(1000, 680), []);
  const experimentManager = useMemo(() => new ExperimentManager(engine), [engine]);

  const [mainTab, setMainTab] = useState<'sandbox' | 'experiments'>('sandbox');

  const [debugSettings, setDebugSettings] = useState<DebugVisualSettings>({
    showRaycasts: true,
    showSteeringVectors: true,
    showTargetLines: true,
    showAIStateBadges: true,
    showCrateBounds: true,
    showHealthBars: true,
    showDetectionRadius: false,
    showPerformanceGraph: true,
  });

  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(engine.selectedNpcId);
  const [, setTick] = useState(0);
  const [showMobilePanel, setShowMobilePanel] = useState(false);

  // Sync state with simulation tick for UI reactivity
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => (t + 1) % 1000);
      if (engine.selectedNpcId !== selectedNpcId) {
        setSelectedNpcId(engine.selectedNpcId);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [engine, selectedNpcId]);

  const selectedNpc = useMemo(() => {
    return engine.npcs.find((n) => n.id === selectedNpcId) || engine.npcs[0] || null;
  }, [engine.npcs, selectedNpcId]);

  const handleSelectNpc = (id: string | null) => {
    engine.selectedNpcId = id;
    setSelectedNpcId(id);
  };

  const handleSpawnNPC = (type: AIType) => {
    const newNpc = engine.spawnNPC(type);
    setSelectedNpcId(newNpc.id);
  };

  const handleRemoveNPCType = (type: AIType) => {
    engine.removeLastNPCOfType(type);
    setSelectedNpcId(engine.selectedNpcId);
  };

  const handleReset = () => {
    engine.resetGame();
    setSelectedNpcId(engine.npcs[0]?.id || null);
  };

  const handleDamageAll = () => {
    engine.damageAllEnemies(45);
  };

  const handleDamageNpc = (id: string) => {
    engine.damageNPC(id, 40);
  };

  const handleTriggerPulse = () => {
    engine.triggerPlayerPulse();
  };

  const handleSelectPreset = (preset: CratePreset) => {
    engine.loadPreset(preset);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-800 overflow-hidden font-sans">
      {/* Top Application Header */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-xs">
            <BrainCircuit className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-slate-900 flex items-center gap-2">
              <span>NPC Driving & Steering AI</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-medium border border-slate-200 hidden sm:inline">
                Evaluation Sandbox
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Comparing Fuzzy Logic, Behavior Trees, Simple FSM, GOAP, and Utility AI
            </p>
          </div>
        </div>

        {/* Top View Mode Navigation Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            id="tab-sandbox-btn"
            onClick={() => {
              if (engine.isExperimentMode) {
                engine.endExperimentMode();
              }
              setMainTab('sandbox');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              mainTab === 'sandbox'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-slate-700" />
            <span>Interactive Arena</span>
          </button>
          <button
            id="tab-experiments-btn"
            onClick={() => setMainTab('experiments')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              mainTab === 'experiments'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
            <span>Evaluation & Experiments</span>
          </button>
        </div>

        {/* Algorithm Legend Pill Badges */}
        <div className="hidden xl:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="font-medium text-[11px]">Fuzzy Logic</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="font-medium text-[11px]">Behavior Tree</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-medium text-[11px]">Simple FSM</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="font-medium text-[11px]">GOAP</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="font-medium text-[11px]">Utility AI</span>
          </div>
        </div>

        {/* Mobile Toggle for Inspector Panel */}
        <div className="flex lg:hidden items-center gap-2">
          {mainTab === 'sandbox' && (
            <button
              id="mobile-inspector-toggle-btn"
              onClick={() => setShowMobilePanel(!showMobilePanel)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                showMobilePanel
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-700 shadow-xs'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              {showMobilePanel ? 'Hide Panel' : 'Inspect AI'}
            </button>
          )}
        </div>
      </header>

      {mainTab === 'sandbox' ? (
        <>
          {/* Controls & Spawners Toolbar */}
          <ControlsToolbar
            engine={engine}
            debugSettings={debugSettings}
            setDebugSettings={setDebugSettings}
            onSpawnNPC={handleSpawnNPC}
            onRemoveNPCType={handleRemoveNPCType}
            onReset={handleReset}
            onDamageAll={handleDamageAll}
            onTriggerPulse={handleTriggerPulse}
            onSelectPreset={handleSelectPreset}
            onOpenExperiments={() => setMainTab('experiments')}
          />

          {/* Main Simulation View & Docked Inspector Panel */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Left/Main Simulation Arena - Map Canvas remains dark and unchanged */}
            <div className="flex-1 relative flex flex-col h-full bg-slate-950 overflow-hidden">
              <GameCanvas
                engine={engine}
                debugSettings={debugSettings}
                selectedNpcId={selectedNpcId}
                onSelectNPC={handleSelectNpc}
              />
              <GameHUD
                engine={engine}
                onTriggerPulse={handleTriggerPulse}
                onRestart={handleReset}
              />
            </div>

            {/* Right Docked AI Inspector Panel (Desktop) */}
            <div className="hidden lg:block w-96 shrink-0 h-full border-l border-slate-200 z-10 bg-white">
              <AIDebugPanel
                engine={engine}
                selectedNpc={selectedNpc}
                onSelectNpc={handleSelectNpc}
                onDamageNpc={handleDamageNpc}
              />
            </div>

            {/* Mobile Slide-Over AI Inspector Panel */}
            {showMobilePanel && (
              <div className="lg:hidden absolute inset-y-0 right-0 w-80 max-w-[90vw] z-30 shadow-2xl bg-white border-l border-slate-200">
                <AIDebugPanel
                  engine={engine}
                  selectedNpc={selectedNpc}
                  onSelectNpc={handleSelectNpc}
                  onDamageNpc={handleDamageNpc}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        /* Evaluation & Experiments Dashboard */
        <ExperimentView
          engine={engine}
          experimentManager={experimentManager}
          debugSettings={debugSettings}
          selectedNpcId={selectedNpcId}
          onSelectNPC={handleSelectNpc}
        />
      )}
    </div>
  );
}
