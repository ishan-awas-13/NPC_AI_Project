/**
 * Controls Toolbar:
 * Simulation controls (play/pause, speed, crate presets),
 * NPC spawners for each AI algorithm, and debug visualization toggles.
 */

import React from 'react';
import { GameEngine } from '../game/GameEngine';
import { DebugVisualSettings, CratePreset, AIType } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Eye,
  Zap,
  Gauge,
  Box,
  Radio,
  Sliders,
  FlaskConical,
  Activity,
} from 'lucide-react';

interface ControlsToolbarProps {
  engine: GameEngine;
  debugSettings: DebugVisualSettings;
  setDebugSettings: React.Dispatch<React.SetStateAction<DebugVisualSettings>>;
  onSpawnNPC: (type: AIType) => void;
  onRemoveNPCType: (type: AIType) => void;
  onReset: () => void;
  onDamageAll: () => void;
  onTriggerPulse: () => void;
  onSelectPreset: (preset: CratePreset) => void;
  onOpenExperiments?: () => void;
}

export const ControlsToolbar: React.FC<ControlsToolbarProps> = ({
  engine,
  debugSettings,
  setDebugSettings,
  onSpawnNPC,
  onRemoveNPCType,
  onReset,
  onDamageAll,
  onTriggerPulse,
  onSelectPreset,
  onOpenExperiments,
}) => {
  const fuzzyCount = engine.npcs.filter((n) => n.aiType === 'fuzzy').length;
  const btCount = engine.npcs.filter((n) => n.aiType === 'behavior_tree').length;
  const simpleCount = engine.npcs.filter((n) => n.aiType === 'simple').length;
  const goapCount = engine.npcs.filter((n) => n.aiType === 'goap').length;
  const utilityCount = engine.npcs.filter((n) => n.aiType === 'utility').length;

  const toggleDebug = (key: keyof DebugVisualSettings) => {
    setDebugSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div
      id="controls-toolbar"
      className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-slate-700 text-xs select-none shadow-2xs"
    >
      {/* 1. Simulation Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          id="play-pause-btn"
          onClick={() => {
            engine.isPaused = !engine.isPaused;
          }}
          className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
            engine.isPaused
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
          }`}
        >
          {engine.isPaused ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" /> Resume
            </>
          ) : (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" /> Pause
            </>
          )}
        </button>

        {/* Speed Selector */}
        <div className="flex bg-slate-200/80 rounded-md p-0.5 border border-slate-300/80">
          {[0.5, 1.0, 2.0].map((s) => (
            <button
              key={s}
              id={`speed-${s}x-btn`}
              onClick={() => {
                engine.timeScale = s;
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-all cursor-pointer ${
                engine.timeScale === s
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          id="reset-game-btn"
          onClick={onReset}
          className="p-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 transition-all shadow-2xs cursor-pointer"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Crate Obstacle Presets */}
        <div className="flex items-center gap-1.5 ml-1">
          <Box className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] text-slate-600 font-medium hidden sm:inline">Crates:</span>
          <select
            id="crate-preset-select"
            value={engine.currentPreset}
            onChange={(e) => onSelectPreset(e.target.value as CratePreset)}
            className="bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 font-medium shadow-2xs cursor-pointer"
          >
            <option value="tactical">Tactical Bunker</option>
            <option value="pillars">6 Pillars Arena</option>
            <option value="corridors">Choke Corridors</option>
            <option value="scattered">Scattered Crates</option>
          </select>
        </div>

        {onOpenExperiments && (
          <button
            id="toolbar-open-experiments-btn"
            onClick={onOpenExperiments}
            className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ml-1"
            title="Open Controlled Experiments & Evaluation Protocols"
          >
            <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
            <span>Experiments</span>
          </button>
        )}
      </div>

      {/* 2. NPC Algorithm Spawners */}
      <div className="flex items-center gap-2">
        {/* Fuzzy Spawner */}
        <div className="flex items-center bg-white border border-slate-200 rounded-md px-2 py-1 gap-1.5 shadow-2xs">
          <div className="w-2.5 h-2.5 rounded-xs bg-cyan-500" />
          <span className="font-semibold text-slate-700 text-[11px]">Fuzzy:</span>
          <span className="font-mono text-slate-900 font-bold w-3 text-center">{fuzzyCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-fuzzy-btn"
              onClick={() => onRemoveNPCType('fuzzy')}
              disabled={fuzzyCount <= 0}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
              title="Remove Fuzzy NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-fuzzy-btn"
              onClick={() => onSpawnNPC('fuzzy')}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
              title="Spawn Fuzzy NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Behavior Tree Spawner */}
        <div className="flex items-center bg-white border border-slate-200 rounded-md px-2 py-1 gap-1.5 shadow-2xs">
          <div className="w-2.5 h-2.5 rounded-xs bg-indigo-500" />
          <span className="font-semibold text-slate-700 text-[11px]">BT:</span>
          <span className="font-mono text-slate-900 font-bold w-3 text-center">{btCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-bt-btn"
              onClick={() => onRemoveNPCType('behavior_tree')}
              disabled={btCount <= 0}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
              title="Remove BT NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-bt-btn"
              onClick={() => onSpawnNPC('behavior_tree')}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
              title="Spawn BT NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Simple Decision Spawner */}
        <div className="flex items-center bg-white border border-slate-200 rounded-md px-2 py-1 gap-1.5 shadow-2xs">
          <div className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
          <span className="font-semibold text-slate-700 text-[11px]">Simple:</span>
          <span className="font-mono text-slate-900 font-bold w-3 text-center">{simpleCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-simple-btn"
              onClick={() => onRemoveNPCType('simple')}
              disabled={simpleCount <= 0}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
              title="Remove Simple NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-simple-btn"
              onClick={() => onSpawnNPC('simple')}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
              title="Spawn Simple NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* GOAP Planner Spawner */}
        <div className="flex items-center bg-white border border-slate-200 rounded-md px-2 py-1 gap-1.5 shadow-2xs">
          <div className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
          <span className="font-semibold text-slate-700 text-[11px]">GOAP:</span>
          <span className="font-mono text-slate-900 font-bold w-3 text-center">{goapCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-goap-btn"
              onClick={() => onRemoveNPCType('goap')}
              disabled={goapCount <= 0}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
              title="Remove GOAP NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-goap-btn"
              onClick={() => onSpawnNPC('goap')}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
              title="Spawn GOAP NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Utility AI Spawner */}
        <div className="flex items-center bg-white border border-slate-200 rounded-md px-2 py-1 gap-1.5 shadow-2xs">
          <div className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
          <span className="font-semibold text-slate-700 text-[11px]">Utility:</span>
          <span className="font-mono text-slate-900 font-bold w-3 text-center">{utilityCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-utility-btn"
              onClick={() => onRemoveNPCType('utility')}
              disabled={utilityCount <= 0}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
              title="Remove Utility NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-utility-btn"
              onClick={() => onSpawnNPC('utility')}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
              title="Spawn Utility NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Action Triggers & Debug Toggles */}
      <div className="flex items-center gap-2">
        {/* Test Flee & Heal Trigger */}
        <button
          id="damage-all-btn"
          onClick={onDamageAll}
          className="px-2.5 py-1.5 rounded-md bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-medium text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          title="Force damage all enemies to immediately trigger retreat and healing driving algorithms"
        >
          <Zap className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden md:inline">Force</span> Low HP (Test Flee)
        </button>

        {/* Debug Gizmos Menu Toggles */}
        <div className="flex items-center bg-slate-200/80 rounded-md p-0.5 border border-slate-300/80">
          <button
            id="toggle-whiskers-btn"
            onClick={() => toggleDebug('showRaycasts')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
              debugSettings.showRaycasts
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toggle Whisker Raycast Sensors"
          >
            Sensors
          </button>
          <button
            id="toggle-vectors-btn"
            onClick={() => toggleDebug('showSteeringVectors')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
              debugSettings.showSteeringVectors
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toggle Steering Velocity Vectors"
          >
            Forces
          </button>
          <button
            id="toggle-targets-btn"
            onClick={() => toggleDebug('showTargetLines')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
              debugSettings.showTargetLines
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toggle Target Lines"
          >
            Targets
          </button>
          <button
            id="toggle-badges-btn"
            onClick={() => toggleDebug('showAIStateBadges')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
              debugSettings.showAIStateBadges
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toggle Overhead AI State Badges"
          >
            Badges
          </button>
          <button
            id="toggle-perf-graph-btn"
            onClick={() => toggleDebug('showPerformanceGraph')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
              debugSettings.showPerformanceGraph
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Toggle Canvas Frame Time and AI Processing Load Graph"
          >
            <Activity className="w-3 h-3" />
            <span>Perf</span>
          </button>
        </div>
      </div>
    </div>
  );
};
