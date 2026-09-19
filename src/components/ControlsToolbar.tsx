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
      className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-slate-300 text-xs select-none"
    >
      {/* 1. Simulation Playback Controls */}
      <div className="flex items-center gap-2">
        <button
          id="play-pause-btn"
          onClick={() => {
            engine.isPaused = !engine.isPaused;
          }}
          className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
            engine.isPaused
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
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
        <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          {[0.5, 1.0, 2.0].map((s) => (
            <button
              key={s}
              id={`speed-${s}x-btn`}
              onClick={() => {
                engine.timeScale = s;
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-all ${
                engine.timeScale === s
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          id="reset-game-btn"
          onClick={onReset}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Crate Obstacle Presets */}
        <div className="flex items-center gap-1.5 ml-1">
          <Box className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400 hidden sm:inline">Crates:</span>
          <select
            id="crate-preset-select"
            value={engine.currentPreset}
            onChange={(e) => onSelectPreset(e.target.value as CratePreset)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
          >
            <option value="tactical">Tactical Bunker</option>
            <option value="pillars">6 Pillars Arena</option>
            <option value="corridors">Choke Corridors</option>
            <option value="scattered">Scattered Crates</option>
          </select>
        </div>
      </div>

      {/* 2. NPC Algorithm Spawners */}
      <div className="flex items-center gap-2">
        {/* Fuzzy Spawner */}
        <div className="flex items-center bg-cyan-950/40 border border-cyan-500/40 rounded-lg px-2 py-1 gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
          <span className="font-semibold text-cyan-300 text-[11px]">Fuzzy:</span>
          <span className="font-mono text-cyan-200 font-bold w-3 text-center">{fuzzyCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-fuzzy-btn"
              onClick={() => onRemoveNPCType('fuzzy')}
              disabled={fuzzyCount <= 0}
              className="p-0.5 rounded hover:bg-cyan-800/50 text-cyan-400 disabled:opacity-30"
              title="Remove Fuzzy NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-fuzzy-btn"
              onClick={() => onSpawnNPC('fuzzy')}
              className="p-0.5 rounded hover:bg-cyan-800/50 text-cyan-400"
              title="Spawn Fuzzy NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Behavior Tree Spawner */}
        <div className="flex items-center bg-purple-950/40 border border-purple-500/40 rounded-lg px-2 py-1 gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-purple-400" />
          <span className="font-semibold text-purple-300 text-[11px]">BT:</span>
          <span className="font-mono text-purple-200 font-bold w-3 text-center">{btCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-bt-btn"
              onClick={() => onRemoveNPCType('behavior_tree')}
              disabled={btCount <= 0}
              className="p-0.5 rounded hover:bg-purple-800/50 text-purple-400 disabled:opacity-30"
              title="Remove BT NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-bt-btn"
              onClick={() => onSpawnNPC('behavior_tree')}
              className="p-0.5 rounded hover:bg-purple-800/50 text-purple-400"
              title="Spawn BT NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Simple Decision Spawner */}
        <div className="flex items-center bg-amber-950/40 border border-amber-500/40 rounded-lg px-2 py-1 gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="font-semibold text-amber-300 text-[11px]">Simple:</span>
          <span className="font-mono text-amber-200 font-bold w-3 text-center">{simpleCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-simple-btn"
              onClick={() => onRemoveNPCType('simple')}
              disabled={simpleCount <= 0}
              className="p-0.5 rounded hover:bg-amber-800/50 text-amber-400 disabled:opacity-30"
              title="Remove Simple NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-simple-btn"
              onClick={() => onSpawnNPC('simple')}
              className="p-0.5 rounded hover:bg-amber-800/50 text-amber-400"
              title="Spawn Simple NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* GOAP Planner Spawner */}
        <div className="flex items-center bg-blue-950/40 border border-blue-500/40 rounded-lg px-2 py-1 gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
          <span className="font-semibold text-blue-300 text-[11px]">GOAP:</span>
          <span className="font-mono text-blue-200 font-bold w-3 text-center">{goapCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-goap-btn"
              onClick={() => onRemoveNPCType('goap')}
              disabled={goapCount <= 0}
              className="p-0.5 rounded hover:bg-blue-800/50 text-blue-400 disabled:opacity-30"
              title="Remove GOAP NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-goap-btn"
              onClick={() => onSpawnNPC('goap')}
              className="p-0.5 rounded hover:bg-blue-800/50 text-blue-400"
              title="Spawn GOAP NPC"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Utility AI Spawner */}
        <div className="flex items-center bg-rose-950/40 border border-rose-500/40 rounded-lg px-2 py-1 gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-rose-400" />
          <span className="font-semibold text-rose-300 text-[11px]">Utility:</span>
          <span className="font-mono text-rose-200 font-bold w-3 text-center">{utilityCount}</span>
          <div className="flex gap-0.5 ml-1">
            <button
              id="minus-utility-btn"
              onClick={() => onRemoveNPCType('utility')}
              disabled={utilityCount <= 0}
              className="p-0.5 rounded hover:bg-rose-800/50 text-rose-400 disabled:opacity-30"
              title="Remove Utility NPC"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="plus-utility-btn"
              onClick={() => onSpawnNPC('utility')}
              className="p-0.5 rounded hover:bg-rose-800/50 text-rose-400"
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
          className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-medium text-xs flex items-center gap-1.5 transition-all"
          title="Force damage all enemies to immediately trigger retreat and healing driving algorithms"
        >
          <Zap className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden md:inline">Force</span> Low HP (Test Flee)
        </button>

        {/* Debug Gizmos Menu Toggles */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
          <button
            id="toggle-whiskers-btn"
            onClick={() => toggleDebug('showRaycasts')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              debugSettings.showRaycasts
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Whisker Raycast Sensors"
          >
            Sensors
          </button>
          <button
            id="toggle-vectors-btn"
            onClick={() => toggleDebug('showSteeringVectors')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              debugSettings.showSteeringVectors
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Steering Velocity Vectors"
          >
            Forces
          </button>
          <button
            id="toggle-targets-btn"
            onClick={() => toggleDebug('showTargetLines')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              debugSettings.showTargetLines
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Target Lines"
          >
            Targets
          </button>
          <button
            id="toggle-badges-btn"
            onClick={() => toggleDebug('showAIStateBadges')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              debugSettings.showAIStateBadges
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Overhead AI State Badges"
          >
            Badges
          </button>
        </div>
      </div>
    </div>
  );
};
