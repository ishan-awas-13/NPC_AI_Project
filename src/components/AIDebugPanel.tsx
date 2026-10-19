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
      className="flex flex-col h-full bg-slate-50 border-l border-slate-200 overflow-hidden text-slate-800"
    >
      {/* Panel Top Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shadow-2xs">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-slate-900" />
          <h2 className="font-bold text-xs tracking-wider text-slate-900 uppercase">
            AI Steering Inspector
          </h2>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shadow-inner">
          <button
            id="tab-inspector-btn"
            onClick={() => setActiveTab('inspector')}
            className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live NPC
          </button>
          <button
            id="tab-comparison-btn"
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Algorithm Guide
          </button>
        </div>
      </div>

      {activeTab === 'inspector' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/70">
          {/* NPC Selector Chips Card */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Select NPC to Inspect</span>
              <span className="text-slate-400 font-normal">Click canvas or chip</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {engine.npcs.map((npc, index) => {
                const isSelected = selectedNpc?.id === npc.id;

                return (
                  <button
                    key={npc.id}
                    id={`select-npc-${npc.id}`}
                    onClick={() => onSelectNpc(npc.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs hover:shadow-xs'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
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
              <div
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 border-l-4"
                style={{ borderLeftColor: selectedNpc.color }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-4 h-4 rounded-sm shadow-2xs"
                      style={{ backgroundColor: selectedNpc.color }}
                    />
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900 leading-none">
                        {selectedNpc.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        ID: {selectedNpc.id.split('_').slice(-2).join('_')}
                      </p>
                    </div>
                  </div>

                  <button
                    id="damage-selected-npc-btn"
                    onClick={() => onDamageNpc(selectedNpc.id)}
                    className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-md flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                    title="Lower health below 35% to trigger flee & heal mechanics"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-600" />
                    Damage (-40HP)
                  </button>
                </div>

                {/* Health Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      Health:
                    </span>
                    <span
                      className={
                        selectedNpc.health <= 35
                          ? 'text-rose-600 font-bold'
                          : selectedNpc.health <= 70
                          ? 'text-amber-600 font-semibold'
                          : 'text-emerald-600 font-semibold'
                      }
                    >
                      {Math.round(selectedNpc.health)} / {selectedNpc.maxHealth} HP
                      {selectedNpc.isHealing ? ' (Healing)' : ''}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300/80">
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
                    <span className="text-slate-600 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-blue-600" />
                      Aggression Stamina:
                    </span>
                    <span
                      className={
                        selectedNpc.isExhausted
                          ? 'text-orange-600 font-bold'
                          : 'text-blue-700 font-semibold'
                      }
                    >
                      {selectedNpc.isExhausted
                        ? `Exhausted (${(selectedNpc.aggressionStamina ?? 0).toFixed(1)}s)`
                        : `${(selectedNpc.aggressionStamina ?? 4.0).toFixed(1)}s / ${(selectedNpc.maxAggressionStamina ?? 4.0).toFixed(0)}s`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300/80">
                    <div
                      className={`h-full transition-all duration-100 ${
                        selectedNpc.isExhausted
                          ? 'bg-orange-500'
                          : (selectedNpc.aggressionStamina ?? 4.0) < 1.5
                          ? 'bg-amber-400'
                          : 'bg-blue-500'
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
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-medium">Current Goal:</span>
                  <span
                    className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] shadow-2xs"
                    style={{
                      backgroundColor: `${selectedNpc.color}18`,
                      color: selectedNpc.color,
                      border: `1px solid ${selectedNpc.color}44`,
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
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-sm">
                <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-600" />
                  Raycast Obstacle Sensors (Whiskers)
                </h4>
                <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[10px]">
                  {selectedNpc.sensors.map((s, i) => {
                    const angleDeg = Math.round((s.angleOffset * 180) / Math.PI);
                    return (
                      <div
                        key={i}
                        className={`p-2 rounded-lg border shadow-2xs transition-all ${
                          s.isBlocked
                            ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="text-[9px] text-slate-400">{angleDeg}°</div>
                        <div className="font-bold">{Math.round(s.hitDistance)}px</div>
                        <div className="text-[8px] uppercase font-medium">
                          {s.isBlocked ? 'Hit' : 'Clear'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              No NPC selected. Click an enemy on the canvas to inspect its steering logic.
            </div>
          )}
        </div>
      ) : (
        /* Comparison Guide Tab */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100/70 text-xs text-slate-700">
          <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-cyan-500 space-y-2.5 shadow-sm hover:shadow transition-shadow">
            <h3 className="font-bold text-sm text-cyan-800 flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-cyan-600" />
              1. Fuzzy Logic AI
            </h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              Instead of binary true/false switches, inputs (Distance, Health, Obstacle Danger) are mapped onto continuous membership curves [0, 1]. Multiple rules fire concurrently with varying degrees of truth, defuzzified into a smooth blended steering vector.
            </p>
            <div className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
              Output = Σ(Rule_Weight × Goal_Vector) / Σ(Rule_Weight)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-indigo-500 space-y-2.5 shadow-sm hover:shadow transition-shadow">
            <h3 className="font-bold text-sm text-indigo-800 flex items-center gap-1.5">
              <GitFork className="w-4 h-4 text-indigo-600" />
              2. Behavior Trees (BT)
            </h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              A hierarchical execution graph composed of Selectors (fallbacks), Sequences (ordered tasks), Conditions, and Actions. Nodes return SUCCESS, RUNNING, or FAILURE. Ideal for modular complex tactical movement like cutting off escape routes behind crates.
            </p>
            <div className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
              Priority: [Heal Sequence] → [Cover Flank] → [Whisker Chase]
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-amber-500 space-y-2.5 shadow-sm hover:shadow transition-shadow">
            <h3 className="font-bold text-sm text-amber-800 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-amber-600" />
              3. Simple Decision Logic (FSM)
            </h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              Hardcoded conditional branch switches (if/else). High performance with minimal computational overhead, but exhibits rigid transitions, abrupt corner bumping, and inability to blend multi-objective goals smoothly.
            </p>
            <div className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
              if (health &lt; 30%) flee_to_heal() else direct_chase()
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-blue-500 space-y-2.5 shadow-sm hover:shadow transition-shadow">
            <h3 className="font-bold text-sm text-blue-800 flex items-center gap-1.5">
              <Workflow className="w-4 h-4 text-blue-600" />
              4. Goal-Oriented Action Planning (GOAP)
            </h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              Decouples goals from actions. Defines world state atoms, prioritized goals, and action pools with preconditions and effects. An A* graph planner searches forward to formulate optimal multi-step plans (e.g. Flank Corner → Intercept → Pounce).
            </p>
            <div className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
              Plan: [MoveToHealStation] → [RegenerateHealth] (Cost: 2.1)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-rose-500 space-y-2.5 shadow-sm hover:shadow transition-shadow">
            <h3 className="font-bold text-sm text-rose-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-rose-600" />
              5. Utility AI Control System
            </h3>
            <p className="text-slate-600 leading-relaxed text-xs">
              Evaluates continuous mathematical response curves (Exponential, Logistic, Quadratic) across competing tactical considerations (health need, proximity, line of sight). Executes the action with the highest calculated utility with inertia damping.
            </p>
            <div className="bg-slate-50 border border-slate-200/90 p-2.5 rounded-lg text-[11px] font-mono text-slate-800 shadow-2xs">
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
    <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-cyan-500 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-cyan-900 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-cyan-600" />
          Fuzzy Membership Values
        </h4>
        <span className="text-[10px] text-slate-500 font-mono">Continuous [0, 1]</span>
      </div>

      {/* Distance Membership Bars */}
      <div className="space-y-1.5 text-xs">
        <div className="text-[11px] font-semibold text-slate-700">Distance to Player:</div>
        <div className="grid grid-cols-3 gap-1.5">
          <MembershipBar label="Near" value={fuzzy.distanceNear} color="#0284c7" />
          <MembershipBar label="Med" value={fuzzy.distanceMed} color="#2563eb" />
          <MembershipBar label="Far" value={fuzzy.distanceFar} color="#4f46e5" />
        </div>
      </div>

      {/* Health Membership Bars */}
      <div className="space-y-1.5 text-xs">
        <div className="text-[11px] font-semibold text-slate-700">Health State:</div>
        <div className="grid grid-cols-3 gap-1.5">
          <MembershipBar label="Low" value={fuzzy.healthLow} color="#dc2626" />
          <MembershipBar label="Med" value={fuzzy.healthMed} color="#d97706" />
          <MembershipBar label="High" value={fuzzy.healthHigh} color="#16a34a" />
        </div>
      </div>

      {/* Activated Rules Table */}
      <div className="space-y-2 text-xs pt-1 border-t border-slate-200">
        <div className="text-[11px] font-semibold text-slate-700">Active Rule Firings:</div>
        <div className="space-y-1.5">
          {fuzzy.activatedRules.map((rule, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/90 text-[11px] shadow-2xs"
            >
              <div className="truncate max-w-[150px]">
                <span className="text-slate-800 font-medium">{rule.rule}</span>
                <span className="text-slate-500 block text-[9px]">{rule.action}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-600"
                    style={{ width: `${rule.weight * 100}%` }}
                  />
                </div>
                <span className="text-slate-800 font-semibold text-[10px] w-6 text-right">
                  {rule.weight.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Defuzzification Outcome */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 text-xs flex justify-between items-center font-mono shadow-2xs">
        <span className="text-slate-700 text-[11px] font-sans font-medium">Speed Multiplier:</span>
        <span className="text-cyan-800 font-bold">{fuzzy.speedMultiplier}x</span>
      </div>
    </div>
  );
};

// 2. Behavior Tree Inspector View
const BehaviorTreeView: React.FC<{ bt: NonNullable<NPC['debugData']['behaviorTree']> }> = ({
  bt,
}) => {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-indigo-500 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
          <GitFork className="w-4 h-4 text-indigo-600" />
          Active Behavior Tree Nodes
        </h4>
        <span className="text-[10px] text-slate-500 font-mono">Live Tick</span>
      </div>

      {/* Current Executing Action Banner */}
      <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-200/80 text-xs shadow-2xs">
        <div className="text-[10px] text-indigo-600 uppercase font-bold tracking-wider">Running Action</div>
        <div className="text-indigo-950 font-mono font-bold text-sm mt-0.5">
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

  let statusBg = 'bg-slate-50 text-slate-700 border-slate-200';
  if (node.status === 'RUNNING') {
    statusBg = 'bg-blue-50 text-blue-900 border-blue-300 font-semibold';
  } else if (node.status === 'SUCCESS') {
    statusBg = 'bg-emerald-50 text-emerald-900 border-emerald-300';
  } else if (node.status === 'FAILURE') {
    statusBg = 'bg-rose-50 text-rose-800 border-rose-300';
  }

  return (
    <div className="space-y-1">
      <div
        className={`p-2 rounded-lg border text-[11px] flex items-center justify-between shadow-2xs ${statusBg} ${
          isActive ? 'ring-2 ring-indigo-400' : ''
        }`}
        style={{ marginLeft: `${depth * 12}px` }}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-[9px] uppercase px-1.5 py-0.5 bg-slate-200/80 rounded text-slate-700 font-bold">
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
    <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-amber-500 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-amber-600" />
          Finite State Logic
        </h4>
        <span className="text-[10px] text-slate-500 font-mono">Discrete Branches</span>
      </div>

      {/* Discrete State Machine Box */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div
          className={`p-2.5 rounded-lg border text-center font-mono shadow-2xs ${
            simple.currentState === 'DIRECT_CHASE'
              ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold ring-1 ring-amber-400'
              : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}
        >
          <div className="text-[10px] uppercase text-slate-500 font-semibold">State 1</div>
          <div className="mt-0.5">DIRECT CHASE</div>
        </div>

        <div
          className={`p-2.5 rounded-lg border text-center font-mono shadow-2xs ${
            simple.currentState === 'FLEE_TO_HEAL'
              ? 'bg-rose-50 border-rose-400 text-rose-900 font-bold ring-1 ring-rose-400'
              : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}
        >
          <div className="text-[10px] uppercase text-slate-500 font-semibold">State 2</div>
          <div className="mt-0.5">FLEE TO HEAL</div>
        </div>
      </div>

      {/* Reason breakdown */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 text-xs space-y-1 shadow-2xs">
        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Active Evaluation Branch:</div>
        <div className="text-slate-800 font-mono text-[11px] leading-relaxed">
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
    <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-blue-500 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
          <Workflow className="w-4 h-4 text-blue-600" />
          GOAP Action Planner
        </h4>
        <span className="text-[10px] text-slate-500 font-mono">
          Replans: {goap.replanCount}
        </span>
      </div>

      {/* Active Goal */}
      <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-200/80 space-y-1 text-xs shadow-2xs">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">Active Goal:</span>
          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-semibold">
            Priority: {goap.goalPriority}
          </span>
        </div>
        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>{goap.currentGoal}</span>
        </div>
      </div>

      {/* Planned Action Sequence */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-[11px] text-slate-600 font-medium">
          <span>Formulated Action Plan ({goap.plan.length} steps):</span>
          <span className="font-mono text-blue-700 font-semibold">Cost: {goap.totalPlanCost}</span>
        </div>
        <div className="space-y-1.5">
          {goap.plan.map((step, idx) => {
            const isRunning = step.status === 'running';
            const isDone = step.status === 'completed';

            return (
              <div
                key={idx}
                className={`p-2 rounded-lg border transition-all shadow-2xs ${
                  isRunning
                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                    : isDone
                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isRunning ? (
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="text-xs">
                      {idx + 1}. {step.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    cost {step.cost.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* World State Atoms */}
      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-1.5 text-xs shadow-2xs">
        <span className="text-[10px] text-slate-500 uppercase font-semibold">
          Current World State Atoms:
        </span>
        <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
          {Object.entries(goap.worldState).map(([atom, val]) => (
            <div
              key={atom}
              className={`px-1.5 py-0.5 rounded border flex items-center justify-between ${
                val
                  ? 'bg-blue-50 border-blue-200 text-blue-800 font-medium'
                  : 'bg-white border-slate-200 text-slate-400'
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
    <div className="p-4 rounded-xl bg-white border border-slate-200 border-l-4 border-l-rose-500 space-y-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
          Utility AI Considerations
        </h4>
        <span className="text-[10px] text-slate-500 font-mono">Response Curves</span>
      </div>

      {/* Selected Action Banner */}
      <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-200/80 space-y-1 text-xs shadow-2xs">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-rose-600 uppercase font-bold tracking-wider">Winning Action (ArgMax):</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-semibold">
            Score: {utility.highestUtility.toFixed(2)}
          </span>
        </div>
        <div className="font-semibold text-rose-900">{utility.selectedAction}</div>
      </div>

      {/* Utility Scores Ranked List */}
      <div className="space-y-2 text-xs">
        <div className="text-[11px] text-slate-700 font-semibold">Ranked Consideration Scores:</div>
        <div className="space-y-1.5">
          {utility.scores.map((scoreInfo) => {
            const isWinner = scoreInfo.isActive;

            return (
              <div
                key={scoreInfo.actionName}
                className={`p-2 rounded-lg border transition-all space-y-1 shadow-2xs ${
                  isWinner
                    ? 'bg-rose-50 border-rose-300 text-rose-950 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="truncate max-w-[200px]">{scoreInfo.actionName}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[10px] px-1 rounded bg-white border border-slate-200 text-slate-600">
                      {scoreInfo.curveType.split(' ')[0]}
                    </span>
                    <span className={isWinner ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                      {scoreInfo.score.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Score Bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300/80">
                  <div
                    className={`h-full transition-all duration-100 ${
                      isWinner ? 'bg-rose-500' : 'bg-slate-400'
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
    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/90 text-center shadow-2xs">
      <div className="text-[10px] text-slate-600 flex justify-between font-medium">
        <span>{label}</span>
        <span className="font-mono text-slate-900 font-semibold">{value.toFixed(2)}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
        <div
          className="h-full transition-all duration-100"
          style={{ width: `${Math.min(100, value * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};
