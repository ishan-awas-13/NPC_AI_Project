/**
 * Game HUD:
 * Displays Player Health, Health Orbs count, Survival Timer,
 * Pulse Wave EMP ability cooldown, keybindings, and Game Over banner.
 */

import React from 'react';
import { GameEngine } from '../game/GameEngine';
import { Heart, Timer, Sparkles, Zap, Shield, RotateCcw } from 'lucide-react';

interface GameHUDProps {
  engine: GameEngine;
  onTriggerPulse: () => void;
  onRestart: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ engine, onTriggerPulse, onRestart }) => {
  const { player, survivalTime, orbsCollected, isGameOver } = engine;
  const hpRatio = Math.max(0, player.health / player.maxHealth);
  const pulseAvailable = player.pulseCooldown <= 0;
  const pulsePercent = Math.max(0, 1 - player.pulseCooldown / player.maxPulseCooldown);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div id="game-hud-overlay" className="pointer-events-none absolute inset-0 select-none">
      {/* Top Left: Player Survival Stats */}
      <div className="pointer-events-auto absolute top-4 left-4 flex flex-col gap-2 max-w-xs">
        {/* Player Health Container */}
        <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-xl p-3 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-100">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span>PLAYER BOX (YOU)</span>
            </div>
            <span
              className={`font-mono font-bold ${
                hpRatio < 0.3 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {Math.round(player.health)} / {player.maxHealth} HP
            </span>
          </div>

          {/* Health Gauge */}
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-700/80 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                hpRatio < 0.3 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${hpRatio * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Heals only via green orbs
            </span>
            <span className="font-mono text-emerald-300 font-semibold">
              +{orbsCollected} picked
            </span>
          </div>
        </div>

        {/* Survival Timer Card */}
        <div className="bg-slate-900/80 border border-slate-700/80 backdrop-blur-md rounded-xl px-3 py-2 shadow-md flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
            <Timer className="w-3.5 h-3.5 text-cyan-400" />
            Survival Duration:
          </span>
          <span className="font-mono font-bold text-cyan-300 text-sm">
            {formatTime(survivalTime)}
          </span>
        </div>
      </div>

      {/* Bottom Left: Controls Quick Guide */}
      <div className="pointer-events-auto absolute bottom-4 left-4 hidden sm:flex items-center gap-2 bg-slate-900/85 border border-slate-800 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] text-slate-300 shadow-md">
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono font-semibold text-slate-200">
            WASD
          </kbd>
          <span>Move</span>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono font-semibold text-slate-200">
            SPACE
          </kbd>
          <span>EMP Pulse</span>
        </div>
        <span className="text-slate-600">•</span>
        <span className="text-slate-400">Click NPC to inspect math</span>
      </div>

      {/* Bottom Center: Shockwave Pulse Action Button */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <button
          id="trigger-pulse-ability-btn"
          onClick={onTriggerPulse}
          disabled={!pulseAvailable || isGameOver}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg transition-all border ${
            pulseAvailable && !isGameOver
              ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400/50 shadow-sky-900/50 active:scale-95'
              : 'bg-slate-800/90 text-slate-500 border-slate-700 cursor-not-allowed'
          }`}
          title="Knock back all nearby enemies and deal 35 damage to trigger retreat AI"
        >
          <Zap className={`w-4 h-4 ${pulseAvailable ? 'text-sky-200 fill-sky-200' : 'text-slate-600'}`} />
          <span>EMP SHOCKWAVE [SPACE]</span>
          {!pulseAvailable && (
            <span className="font-mono text-[11px] text-sky-400">
              ({player.pulseCooldown.toFixed(1)}s)
            </span>
          )}
        </button>
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="pointer-events-auto absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-100">Player Depleted</h2>
              <p className="text-xs text-slate-400 mt-1">
                Caught by enemy steering pursuit vectors.
              </p>
            </div>

            <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Survival Time:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {formatTime(survivalTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Health Orbs Collected:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {orbsCollected}
                </span>
              </div>
            </div>

            <button
              id="gameover-restart-btn"
              onClick={onRestart}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Restart Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
