/**
 * Interactive AI Inspector Panel:
 * Visualizes real-time membership curves, active rules, Behavior Tree nodes,
 * and Simple State Machine conditions for the selected NPC.
 */

import React, { useState } from 'react';
import { NPC, AIType, BTNodeSnapshot } from '../types';
import { GameEngine } from '../game/GameEngine';
import {
  BrainCircuit,
  GitFork,
  Cpu,
  Heart,
  Zap,
  Activity,
  AlertTriangle,
  Compass,
  Layers,
  ChevronRight,
  Sparkles,
  Target,
  Workflow,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface AIDebugPanelProps {
  engine: GameEngine;
  selectedNpc: NPC | null;
  onSelectNpc: (id: string) => void;
  onDamageNpc: (id: string) => void;
}

export const AIDebugPanel: React.FC<AIDebugPanelProps> = ({
  engine,
  selectedNpc,
  onSelectNpc,
  onDamageNpc,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'comparison'>('inspector');

  return (
    <div
      id="ai-debug-panel"
      className="flex flex-col h-full bg-slate-900/95 border-l border-slate-800 backdrop-blur-md overflow-hidden text-slate-200"
    >
      {/* Panel Top Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-cyan-400" />
          <h2 className="font-semibold text-sm tracking-wide text-slate-100 uppercase">
            AI Steering Inspector
          </h2>
        </div>
        <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
          <button
            id="tab-inspector-btn"
            onClick={() => setActiveTab('inspector')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'inspector'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live NPC
          </button>
          <button
            id="tab-comparison-btn"
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeTab === 'comparison'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Algorithm Guide
          </button>
        </div>
      </div>

      {activeTab === 'inspector' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* NPC Selector Chips */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Select NPC to Inspect</span>
              <span className="text-slate-500 font-normal">Click canvas or chip</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {engine.npcs.map((npc, index) => {
                const isSelected = selectedNpc?.id === npc.id;
                let badgeColor = 'border-cyan-500/40 text-cyan-300';
                if (npc.aiType === 'behavior_tree') badgeColor = 'border-purple-500/40 text-purple-300';
                if (npc.aiType === 'simple') badgeColor = 'border-amber-500/40 text-amber-300';
                if (npc.aiType === 'goap') badgeColor = 'border-blue-500/40 text-blue-300';
                if (npc.aiType === 'utility') badgeColor = 'border-rose-500/40 text-rose-300';

                return (
                  <button
                    key={npc.id}
                    id={`select-npc-${npc.id}`}
                    onClick={() => onSelectNpc(npc.id)}
                    className={`px-2.5 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-slate-800 ring-2 ring-cyan-400 text-white border-transparent'
                        : `bg-slate-800/40 hover:bg-slate-800/80 ${badgeColor}`
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: npc.color }}
                    />
                    <span className="truncate max-w-[110px]">
                      {npc.aiType === 'fuzzy'
                        ? `Fuzzy #${index + 1}`
                        : npc.aiType === 'behavior_tree'
                        ? `BT #${index + 1}`
                        : npc.aiType === 'goap'
                        ? `GOAP #${index + 1}`
                        : npc.aiType === 'utility'
                        ? `Utility #${index + 1}`
                        : `Simple #${index + 1}`}
                    </span>
                    <span className="text-[10px] opacity-75 font-mono">
                      {Math.round(npc.health)}HP
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedNpc ? (
            <>
              {/* Selected NPC Overview Card */}
              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: selectedNpc.color }}
                    />
                    <div>
                      <h3 className="font-semibold text-sm text-slate-100 leading-none">
                        {selectedNpc.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        ID: {selectedNpc.id.split('_').slice(-2).join('_')}
                      </p>
                    </div>
                  </div>

                  <button
                    id="damage-selected-npc-btn"
                    onClick={() => onDamageNpc(selectedNpc.id)}
                    className="px-2.5 py-1 text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg flex items-center gap-1 transition-all"
                    title="Lower health below 35% to trigger flee & heal mechanics"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    Damage (-40HP)
                  </button>
                </div>

                {/* Health Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      Health:
                    </span>
                    <span
                      className={
                        selectedNpc.health <= 35
                          ? 'text-rose-400 font-bold'
                          : selectedNpc.health <= 70
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }
                    >
                      {Math.round(selectedNpc.health)} / {selectedNpc.maxHealth} HP
                      {selectedNpc.isHealing ? ' (Healing in Shrine)' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full transition-all duration-150 ${
                        selectedNpc.health <= 35
                          ? 'bg-rose-500'
                          : selectedNpc.health <= 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.max(0, (selectedNpc.health / selectedNpc.maxHealth) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Aggression Stamina Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      Aggression Stamina:
                    </span>
                    <span
                      className={
                        selectedNpc.isExhausted
                          ? 'text-orange-400 font-bold animate-pulse'
                          : 'text-cyan-300'
                      }
                    >
                      {selectedNpc.isExhausted
                        ? `Exhausted (${(selectedNpc.aggressionStamina ?? 0).toFixed(1)}s / ${(selectedNpc.maxAggressionStamina ?? 4.0).toFixed(0)}s)`
                        : `${(selectedNpc.aggressionStamina ?? 4.0).toFixed(1)}s / ${(selectedNpc.maxAggressionStamina ?? 4.0).toFixed(0)}s`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full transition-all duration-100 ${
                        selectedNpc.isExhausted
                          ? 'bg-orange-500'
                          : (selectedNpc.aggressionStamina ?? 4.0) < 1.5
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                      }`}
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            ((selectedNpc.aggressionStamina ?? 4.0) /
                              (selectedNpc.maxAggressionStamina ?? 4.0)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Live State Badge */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
                  <span className="text-slate-400">Current AI Goal:</span>
                  <span
                    className="px-2 py-0.5 rounded font-mono font-semibold text-[11px]"
                    style={{
                      backgroundColor: `${selectedNpc.color}22`,
                      color: selectedNpc.accentColor,
                      border: `1px solid ${selectedNpc.color}55`,
                    }}
                  >
                    {selectedNpc.debugData.stateBadge}
                  </span>
                </div>
              </div>

              {/* Algorithm-Specific Detail Sections */}
              {selectedNpc.aiType === 'fuzzy' && selectedNpc.debugData.fuzzy && (
                <FuzzyView fuzzy={selectedNpc.debugData.fuzzy} />
              )}

              {selectedNpc.aiType === 'behavior_tree' &&
                selectedNpc.debugData.behaviorTree && (
                  <BehaviorTreeView bt={selectedNpc.debugData.behaviorTree} />
                )}

              {selectedNpc.aiType === 'simple' && selectedNpc.debugData.simple && (
                <SimpleLogicView simple={selectedNpc.debugData.simple} />
              )}

              {selectedNpc.aiType === 'goap' && selectedNpc.debugData.goap && (
                <GOAPView goap={selectedNpc.debugData.goap} />
              )}

              {selectedNpc.aiType === 'utility' && selectedNpc.debugData.utility && (
                <UtilityAIView utility={selectedNpc.debugData.utility} />
              )}

              {/* Sensor Readings */}
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  Raycast Obstacle Sensors (Whiskers)
                </h4>
                <div className="grid grid-cols-5 gap-1 text-center font-mono text-[10px]">
                  {selectedNpc.sensors.map((s, i) => {
                    const angleDeg = Math.round((s.angleOffset * 180) / Math.PI);
                    return (
                      <div
                        key={i}
                        className={`p-1.5 rounded border ${
                          s.isBlocked
                            ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                            : 'bg-slate-900/60 border-slate-700/50 text-slate-400'
                        }`}
                      >
                        <div className="text-[9px] text-slate-500">{angleDeg}°</div>
                        <div className="font-bold">{Math.round(s.hitDistance)}px</div>
                        <div className="text-[8px] uppercase">
                          {s.isBlocked ? 'Hit' : 'Clear'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              No NPC selected. Click an enemy on the canvas to inspect its steering logic.
            </div>
          )}
        </div>
      ) : (
        /* Comparison Guide Tab */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
            <h3 className="font-semibold text-sm text-cyan-400 flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4" />
              1. Fuzzy Logic AI
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Instead of binary true/false switches, inputs (Distance, Health, Obstacle Danger) are mapped onto continuous membership curves [0, 1]. Multiple rules fire concurrently with varying degrees of truth, defuzzified into a smooth blended steering vector.
            </p>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800 text-[11px] font-mono text-cyan-300">
              Output = Σ(Rule_Weight × Goal_Vector) / Σ(Rule_Weight)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
            <h3 className="font-semibold text-sm text-purple-400 flex items-center gap-1.5">
              <GitFork className="w-4 h-4" />
              2. Behavior Trees (BT)
            </h3>
            <p className="text-slate-300 leading-relaxed">
              A hierarchical execution graph composed of Selectors (fallbacks), Sequences (ordered tasks), Conditions, and Actions. Nodes return SUCCESS, RUNNING, or FAILURE. Ideal for modular complex tactical movement like cutting off escape routes behind crates.
            </p>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800 text-[11px] font-mono text-purple-300">
              Priority: [Heal Sequence] → [Cover Flank] → [Whisker Chase]
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
            <h3 className="font-semibold text-sm text-amber-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              3. Simple Decision Logic (FSM)
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Hardcoded conditional branch switches (if/else). High performance with minimal computational overhead, but exhibits rigid transitions, abrupt corner bumping, and inability to blend multi-objective goals smoothly.
            </p>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800 text-[11px] font-mono text-amber-300">
              if (health &lt; 30%) flee_to_heal() else direct_chase()
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
            <h3 className="font-semibold text-sm text-blue-400 flex items-center gap-1.5">
              <Workflow className="w-4 h-4" />
              4. Goal-Oriented Action Planning (GOAP)
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Decouples goals from actions. Defines world state atoms, prioritized goals, and action pools with preconditions and effects. An A* graph planner searches forward to formulate optimal multi-step plans (e.g. Flank Corner → Intercept → Pounce).
            </p>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800 text-[11px] font-mono text-blue-300">
              Plan: [MoveToHealStation] → [RegenerateHealth] (Cost: 2.1)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
            <h3 className="font-semibold text-sm text-rose-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              5. Utility AI Control System
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Evaluates continuous mathematical response curves (Exponential, Logistic, Quadratic) across competing tactical considerations (health need, proximity, line of sight). Executes the action with the highest calculated utility with inertia damping.
            </p>
            <div className="bg-slate-950/70 p-2 rounded border border-slate-800 text-[11px] font-mono text-rose-300">
              U(heal) = (1 - hp)^2.2 × weight → argmax(U)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 1. Fuzzy Logic Inspector View
const FuzzyView: React.FC<{ fuzzy: NPC['debugData']['fuzzy'] }> = ({ fuzzy }) => {
  if (!fuzzy) return null;

  return (
    <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Fuzzy Membership Values
        </h4>
        <span className="text-[10px] text-cyan-400/80 font-mono">Continuous [0, 1]</span>
      </div>

      {/* Distance Membership Bars */}
      <div className="space-y-1 text-xs">
        <div className="text-[11px] font-medium text-slate-400">Distance to Player:</div>
        <div className="grid grid-cols-3 gap-1.5">
          <MembershipBar label="Near" value={fuzzy.distanceNear} color="#06b6d4" />
          <MembershipBar label="Med" value={fuzzy.distanceMed} color="#3b82f6" />
          <MembershipBar label="Far" value={fuzzy.distanceFar} color="#6366f1" />
        </div>
      </div>

      {/* Health Membership Bars */}
      <div className="space-y-1 text-xs">
        <div className="text-[11px] font-medium text-slate-400">Health State:</div>
        <div className="grid grid-cols-3 gap-1.5">
          <MembershipBar label="Low" value={fuzzy.healthLow} color="#ef4444" />
          <MembershipBar label="Med" value={fuzzy.healthMed} color="#f59e0b" />
          <MembershipBar label="High" value={fuzzy.healthHigh} color="#10b981" />
        </div>
      </div>

      {/* Activated Rules Table */}
      <div className="space-y-1 text-xs pt-1 border-t border-cyan-500/20">
        <div className="text-[11px] font-medium text-slate-400">Active Rule Firings:</div>
        <div className="space-y-1">
          {fuzzy.activatedRules.map((rule, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800 text-[11px]"
            >
              <div className="truncate max-w-[150px]">
                <span className="text-slate-300">{rule.rule}</span>
                <span className="text-slate-500 block text-[9px]">{rule.action}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${rule.weight * 100}%` }}
                  />
                </div>
                <span className="text-cyan-300 text-[10px] w-6 text-right">
                  {rule.weight.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Defuzzification Outcome */}
      <div className="p-2 rounded bg-cyan-900/30 border border-cyan-500/40 text-xs flex justify-between items-center font-mono">
        <span className="text-slate-300 text-[11px]">Speed Multiplier:</span>
        <span className="text-cyan-300 font-bold">{fuzzy.speedMultiplier}x</span>
      </div>
    </div>
  );
};

// 2. Behavior Tree Inspector View
const BehaviorTreeView: React.FC<{ bt: NonNullable<NPC['debugData']['behaviorTree']> }> = ({
  bt,
}) => {
  return (
    <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
          <GitFork className="w-3.5 h-3.5 text-purple-400" />
          Active Behavior Tree Nodes
        </h4>
        <span className="text-[10px] text-purple-400 font-mono">Live Tick</span>
      </div>

      {/* Current Executing Action Banner */}
      <div className="p-2 rounded bg-purple-900/40 border border-purple-500/40 text-xs">
        <div className="text-[10px] text-purple-300 uppercase font-semibold">Running Action</div>
        <div className="text-white font-mono font-bold text-sm mt-0.5">
          {bt.currentAction || 'Whisker Chase'}
        </div>
      </div>

      {/* Node Hierarchy Tree */}
      <div className="space-y-1.5 text-xs font-mono">
        {bt.rootSnapshot.children?.map((branch) => (
          <TreeNodeItem
            key={branch.id}
            node={branch}
            activePath={bt.activePath}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
};

const TreeNodeItem: React.FC<{
  node: BTNodeSnapshot;
  activePath: string[];
  depth: number;
}> = ({ node, activePath, depth }) => {
  const isActive = activePath.includes(node.id);

  let statusBg = 'bg-slate-800/40 text-slate-400 border-slate-700/40';
  if (node.status === 'RUNNING') {
    statusBg = 'bg-blue-600/30 text-blue-300 border-blue-500/60 font-bold';
  } else if (node.status === 'SUCCESS') {
    statusBg = 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60';
  } else if (node.status === 'FAILURE') {
    statusBg = 'bg-rose-950/30 text-rose-400 border-rose-800/40';
  }

  return (
    <div className="space-y-1">
      <div
        className={`p-1.5 rounded border text-[11px] flex items-center justify-between ${statusBg} ${
          isActive ? 'ring-1 ring-purple-400' : ''
        }`}
        style={{ marginLeft: `${depth * 12}px` }}
      >
        <div className="flex items-center gap-1 truncate">
          <span className="text-[9px] uppercase px-1 py-0.2 bg-black/40 rounded text-slate-400">
            {node.type[0].toUpperCase()}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
          {node.status}
        </span>
      </div>

      {node.children &&
        node.children.map((child) => (
          <TreeNodeItem
            key={child.id}
            node={child}
            activePath={activePath}
            depth={depth + 1}
          />
        ))}
    </div>
  );
};

// 3. Simple Logic Inspector View
const SimpleLogicView: React.FC<{ simple: NPC['debugData']['simple'] }> = ({ simple }) => {
  if (!simple) return null;

  return (
    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-amber-400" />
          Finite State Logic
        </h4>
        <span className="text-[10px] text-amber-400 font-mono">Discrete Branches</span>
      </div>

      {/* Discrete State Machine Box */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div
          className={`p-2 rounded border text-center font-mono ${
            simple.currentState === 'DIRECT_CHASE'
              ? 'bg-amber-600/30 border-amber-400 text-amber-200 font-bold'
              : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}
        >
          <div className="text-[10px] uppercase text-slate-400">State 1</div>
          <div>DIRECT CHASE</div>
        </div>

        <div
          className={`p-2 rounded border text-center font-mono ${
            simple.currentState === 'FLEE_TO_HEAL'
              ? 'bg-rose-600/30 border-rose-400 text-rose-200 font-bold'
              : 'bg-slate-900/60 border-slate-800 text-slate-500'
          }`}
        >
          <div className="text-[10px] uppercase text-slate-400">State 2</div>
          <div>FLEE TO HEAL</div>
        </div>
      </div>

      {/* Reason breakdown */}
      <div className="p-2 rounded bg-slate-900/70 border border-slate-800 text-xs space-y-1">
        <div className="text-[10px] text-slate-400 font-medium">Active Evaluation Branch:</div>
        <div className="text-slate-200 font-mono text-[11px] leading-relaxed">
          {simple.reason}
        </div>
      </div>
    </div>
  );
};

// 4. Goal-Oriented Action Planning (GOAP) Inspector View
const GOAPView: React.FC<{ goap: NPC['debugData']['goap'] }> = ({ goap }) => {
  if (!goap) return null;

  return (
    <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
          <Workflow className="w-3.5 h-3.5 text-blue-400" />
          GOAP Action Planner
        </h4>
        <span className="text-[10px] text-blue-400 font-mono">
          Replans: {goap.replanCount}
        </span>
      </div>

      {/* Active Goal */}
      <div className="p-2 rounded bg-slate-900/70 border border-slate-800 space-y-1 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Goal:</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-950 border border-blue-500/40 text-blue-300 font-mono text-[10px]">
            Priority: {goap.goalPriority}
          </span>
        </div>
        <div className="font-semibold text-blue-200 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{goap.currentGoal}</span>
        </div>
      </div>

      {/* Planned Action Sequence */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-[11px] text-slate-400 font-medium">
          <span>Formulated Action Plan ({goap.plan.length} steps):</span>
          <span className="font-mono text-blue-300">Cost: {goap.totalPlanCost}</span>
        </div>
        <div className="space-y-1">
          {goap.plan.map((step, idx) => {
            const isRunning = step.status === 'running';
            const isDone = step.status === 'completed';

            return (
              <div
                key={idx}
                className={`p-2 rounded border transition-all ${
                  isRunning
                    ? 'bg-blue-900/30 border-blue-400 text-white font-semibold'
                    : isDone
                    ? 'bg-slate-900/40 border-slate-800 text-slate-400'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isRunning ? (
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="text-xs">
                      {idx + 1}. {step.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    cost {step.cost.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* World State Atoms */}
      <div className="p-2 rounded bg-slate-900/70 border border-slate-800 space-y-1.5 text-xs">
        <span className="text-[10px] text-slate-400 uppercase font-semibold">
          Current World State Atoms:
        </span>
        <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
          {Object.entries(goap.worldState).map(([atom, val]) => (
            <div
              key={atom}
              className={`px-1.5 py-0.5 rounded border flex items-center justify-between ${
                val
                  ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                  : 'bg-slate-950/40 border-slate-800 text-slate-500'
              }`}
            >
              <span className="truncate">{atom}</span>
              <span className="font-bold">{val ? 'T' : 'F'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 5. Utility AI Inspector View
const UtilityAIView: React.FC<{ utility: NPC['debugData']['utility'] }> = ({ utility }) => {
  if (!utility) return null;

  return (
    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
          Utility AI Considerations
        </h4>
        <span className="text-[10px] text-rose-400/80 font-mono">Response Curves</span>
      </div>

      {/* Selected Action Banner */}
      <div className="p-2 rounded bg-slate-900/70 border border-slate-800 space-y-1 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Winning Action (ArgMax):</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/40 text-rose-300 font-mono text-[10px]">
            Score: {utility.highestUtility.toFixed(2)}
          </span>
        </div>
        <div className="font-semibold text-rose-200">{utility.selectedAction}</div>
      </div>

      {/* Utility Scores Ranked List */}
      <div className="space-y-2 text-xs">
        <div className="text-[11px] text-slate-400 font-medium">Ranked Consideration Scores:</div>
        <div className="space-y-1.5">
          {utility.scores.map((scoreInfo) => {
            const isWinner = scoreInfo.isActive;

            return (
              <div
                key={scoreInfo.actionName}
                className={`p-2 rounded border transition-all space-y-1 ${
                  isWinner
                    ? 'bg-rose-950/40 border-rose-500/60 text-white font-semibold'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="truncate max-w-[200px]">{scoreInfo.actionName}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400">
                      {scoreInfo.curveType.split(' ')[0]}
                    </span>
                    <span className={isWinner ? 'text-rose-300 font-bold' : 'text-slate-400'}>
                      {scoreInfo.score.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Score Bar */}
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-100 ${
                      isWinner ? 'bg-rose-500' : 'bg-slate-700'
                    }`}
                    style={{ width: `${Math.min(100, scoreInfo.score * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Helper for membership bars
const MembershipBar: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => {
  return (
    <div className="p-1.5 rounded bg-slate-900/70 border border-slate-800 text-center">
      <div className="text-[10px] text-slate-400 flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-slate-200">{value.toFixed(2)}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
        <div
          className="h-full transition-all duration-100"
          style={{ width: `${Math.min(100, value * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};
