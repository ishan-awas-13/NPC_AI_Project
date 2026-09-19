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
} from 'lucide-react';

export default function App() {
  const engine = useMemo(() => new GameEngine(1000, 680), []);

  const [debugSettings, setDebugSettings] = useState<DebugVisualSettings>({
    showRaycasts: true,
    showSteeringVectors: true,
    showTargetLines: true,
    showAIStateBadges: true,
    showCrateBounds: true,
    showHealthBars: true,
    showDetectionRadius: false,
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
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-sm">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-white flex items-center gap-2">
              <span>NPC Driving & Steering AI</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700 hidden sm:inline">
                Top-Down Survival Demo
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Comparing Fuzzy Logic, Behavior Trees, and Simple Decision Logic with Crate Obstacle Avoidance
            </p>
          </div>
        </div>

        {/* Algorithm Legend Pill Badges */}
        <div className="hidden lg:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
            <span className="font-medium">Fuzzy AI Logic</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
            <span className="font-medium">Behavior Tree</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            <span className="font-medium">Simple Decision</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            <span className="font-medium">Player Box</span>
          </div>
        </div>

        {/* Mobile Toggle for Inspector Panel */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            id="mobile-inspector-toggle-btn"
            onClick={() => setShowMobilePanel(!showMobilePanel)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              showMobilePanel
                ? 'bg-cyan-600 border-cyan-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {showMobilePanel ? 'Hide AI Panel' : 'Inspect AI'}
          </button>
        </div>
      </header>

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
      />

      {/* Main Simulation View & Docked Inspector Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left/Main Simulation Arena */}
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
        <div className="hidden lg:block w-96 shrink-0 h-full border-l border-slate-800 z-10">
          <AIDebugPanel
            engine={engine}
            selectedNpc={selectedNpc}
            onSelectNpc={handleSelectNpc}
            onDamageNpc={handleDamageNpc}
          />
        </div>

        {/* Mobile Slide-Over AI Inspector Panel */}
        {showMobilePanel && (
          <div className="lg:hidden absolute inset-y-0 right-0 w-80 max-w-[90vw] z-30 shadow-2xl">
            <AIDebugPanel
              engine={engine}
              selectedNpc={selectedNpc}
              onSelectNpc={handleSelectNpc}
              onDamageNpc={handleDamageNpc}
            />
          </div>
        )}
      </div>
    </div>
  );
}
