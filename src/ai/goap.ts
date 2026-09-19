/**
 * Goal-Oriented Action Planning (GOAP) AI:
 * Formulates dynamic multi-step plans using world state atoms,
 * prioritized goals, an action pool with preconditions & effects,
 * and an A* state-space planner.
 */

import { Vector2, NPC, Player, Crate, HealingStation, GOAPActionInfo, GOAPDebugState } from '../types';
import { Math2D } from '../utils/math';

export interface GOAPWorldState {
  [key: string]: boolean;
}

export interface GOAPActionDefinition {
  name: string;
  preconditions: GOAPWorldState;
  effects: GOAPWorldState;
  getCost: (npc: NPC, player: Player, nearestHeal: HealingStation | null) => number;
  getTargetPoint: (
    npc: NPC,
    player: Player,
    crates: Crate[],
    nearestHeal: HealingStation | null
  ) => Vector2;
  isComplete: (npc: NPC, player: Player, nearestHeal: HealingStation | null) => boolean;
}

export interface GOAPGoal {
  name: string;
  getPriority: (npc: NPC, worldState: GOAPWorldState) => number;
  desiredState: GOAPWorldState;
}

interface PlanNode {
  state: GOAPWorldState;
  action: GOAPActionDefinition | null;
  parent: PlanNode | null;
  gCost: number;
  hCost: number;
  fCost: number;
}

export class GOAPPlanner {
  private static goals: GOAPGoal[] = [
    {
      name: 'Survive & Regenerate',
      getPriority: (npc) => (npc.health <= 35 ? 95 : 0),
      desiredState: { isHealthy: true },
    },
    {
      name: 'Flank Obscured Player',
      getPriority: (npc, worldState) =>
        !worldState.hasLineOfSight && npc.health > 35 ? 70 : 0,
      desiredState: { hasLineOfSight: true, inCombatRange: true },
    },
    {
      name: 'Strike Player',
      getPriority: (npc) => (npc.health > 35 ? 50 : 10),
      desiredState: { inMeleeRange: true },
    },
  ];

  private static actions: GOAPActionDefinition[] = [
    {
      name: 'Navigate to Healing Shrine',
      preconditions: {},
      effects: { atHealingStation: true },
      getCost: (npc, _player, nearestHeal) => {
        if (!nearestHeal) return 100;
        const d = Math2D.dist(npc, {
          x: nearestHeal.x + nearestHeal.width / 2,
          y: nearestHeal.y + nearestHeal.height / 2,
        });
        return Math.max(1, d / 120);
      },
      getTargetPoint: (_npc, _player, _crates, nearestHeal) => {
        if (!nearestHeal) return { x: 500, y: 350 };
        return {
          x: nearestHeal.x + nearestHeal.width / 2,
          y: nearestHeal.y + nearestHeal.height / 2,
        };
      },
      isComplete: (npc, _player, nearestHeal) => {
        if (!nearestHeal) return true;
        return (
          npc.x >= nearestHeal.x &&
          npc.x <= nearestHeal.x + nearestHeal.width &&
          npc.y >= nearestHeal.y &&
          npc.y <= nearestHeal.y + nearestHeal.height
        );
      },
    },
    {
      name: 'Regenerate HP in Shrine',
      preconditions: { atHealingStation: true },
      effects: { isHealthy: true, isCriticallyInjured: false },
      getCost: () => 1,
      getTargetPoint: (_npc, _player, _crates, nearestHeal) => {
        if (!nearestHeal) return { x: 500, y: 350 };
        return {
          x: nearestHeal.x + nearestHeal.width / 2,
          y: nearestHeal.y + nearestHeal.height / 2,
        };
      },
      isComplete: (npc) => npc.health >= 85,
    },
    {
      name: 'Corner Flank Maneuver',
      preconditions: { hasLineOfSight: false },
      effects: { hasLineOfSight: true, inCombatRange: true },
      getCost: () => 2,
      getTargetPoint: (npc, player, crates) => {
        // Find blocking crate and flank around the nearest corner
        const blockingCrate = crates.find((c) =>
          !Math2D.hasLineOfSight(npc, player, [c])
        );
        if (!blockingCrate) return { x: player.x, y: player.y };

        const corners: Vector2[] = [
          { x: blockingCrate.x - 30, y: blockingCrate.y - 30 },
          { x: blockingCrate.x + blockingCrate.width + 30, y: blockingCrate.y - 30 },
          { x: blockingCrate.x - 30, y: blockingCrate.y + blockingCrate.height + 30 },
          {
            x: blockingCrate.x + blockingCrate.width + 30,
            y: blockingCrate.y + blockingCrate.height + 30,
          },
        ];

        let bestCorner = corners[0];
        let bestDist = Infinity;
        for (const c of corners) {
          const d = Math2D.dist(npc, c) + Math2D.dist(c, player);
          if (d < bestDist) {
            bestDist = d;
            bestCorner = c;
          }
        }
        return bestCorner;
      },
      isComplete: (npc, player, _nearestHeal) => {
        return Math2D.dist(npc, player) < 160;
      },
    },
    {
      name: 'Predictive Intercept Gap',
      preconditions: { hasLineOfSight: true },
      effects: { inCombatRange: true },
      getCost: (npc, player) => {
        return Math2D.dist(npc, player) / 150;
      },
      getTargetPoint: (npc, player) => {
        const leadTime = Math.min(0.4, Math2D.dist(npc, player) / 400);
        return {
          x: player.x + player.vx * leadTime,
          y: player.y + player.vy * leadTime,
        };
      },
      isComplete: (npc, player) => {
        return Math2D.dist(npc, player) <= 150;
      },
    },
    {
      name: 'Melee Pounce Attack',
      preconditions: { inCombatRange: true, hasLineOfSight: true },
      effects: { inMeleeRange: true },
      getCost: () => 1,
      getTargetPoint: (_npc, player) => {
        return { x: player.x, y: player.y };
      },
      isComplete: (npc, player) => {
        return Math2D.dist(npc, player) <= 40;
      },
    },
  ];

  // Helper: check if a state satisfies required conditions
  private static satisfies(current: GOAPWorldState, required: GOAPWorldState): boolean {
    for (const key of Object.keys(required)) {
      if (current[key] !== required[key]) {
        return false;
      }
    }
    return true;
  }

  // Helper: apply action effects to a state
  private static applyEffects(state: GOAPWorldState, effects: GOAPWorldState): GOAPWorldState {
    return { ...state, ...effects };
  }

  // A* Forward Search Planner
  public static plan(
    startState: GOAPWorldState,
    goalState: GOAPWorldState,
    npc: NPC,
    player: Player,
    nearestHeal: HealingStation | null
  ): GOAPActionDefinition[] | null {
    const openSet: PlanNode[] = [
      {
        state: { ...startState },
        action: null,
        parent: null,
        gCost: 0,
        hCost: 0,
        fCost: 0,
      },
    ];

    const visited: string[] = [];
    const stateKey = (s: GOAPWorldState) =>
      Object.keys(s)
        .sort()
        .map((k) => `${k}:${s[k]}`)
        .join('|');

    while (openSet.length > 0) {
      // Find lowest fCost node
      openSet.sort((a, b) => a.fCost - b.fCost);
      const current = openSet.shift()!;

      if (this.satisfies(current.state, goalState)) {
        // Reconstruct plan sequence
        const plan: GOAPActionDefinition[] = [];
        let curr: PlanNode | null = current;
        while (curr && curr.action) {
          plan.unshift(curr.action);
          curr = curr.parent;
        }
        return plan;
      }

      const key = stateKey(current.state);
      if (visited.includes(key)) continue;
      visited.push(key);

      // Expand actions
      for (const action of this.actions) {
        if (this.satisfies(current.state, action.preconditions)) {
          const nextState = this.applyEffects(current.state, action.effects);
          const nextKey = stateKey(nextState);
          if (visited.includes(nextKey)) continue;

          const actionCost = action.getCost(npc, player, nearestHeal);
          const gCost = current.gCost + actionCost;

          // Simple heuristic: count unsatisfied goal variables
          let hCost = 0;
          for (const k of Object.keys(goalState)) {
            if (nextState[k] !== goalState[k]) hCost += 1;
          }

          openSet.push({
            state: nextState,
            action,
            parent: current,
            gCost,
            hCost,
            fCost: gCost + hCost,
          });
        }
      }
    }

    return null;
  }

  // Sense the world and return current atom state
  public static senseWorld(
    npc: NPC,
    player: Player,
    crates: Crate[],
    nearestHeal: HealingStation | null
  ): GOAPWorldState {
    const distToPlayer = Math2D.dist(npc, player);
    const hasLOS = Math2D.hasLineOfSight(npc, player, crates);

    let atHealStation = false;
    if (nearestHeal) {
      atHealStation =
        npc.x >= nearestHeal.x &&
        npc.x <= nearestHeal.x + nearestHeal.width &&
        npc.y >= nearestHeal.y &&
        npc.y <= nearestHeal.y + nearestHeal.height;
    }

    return {
      playerAlive: player.health > 0,
      inMeleeRange: distToPlayer <= 42,
      inCombatRange: distToPlayer <= 160,
      hasLineOfSight: hasLOS,
      isCriticallyInjured: npc.health <= 35,
      atHealingStation: atHealStation,
      isHealthy: npc.health >= 85,
    };
  }

  public static getGoals(): GOAPGoal[] {
    return this.goals;
  }
}

// Persistent per-NPC GOAP Execution State
export interface GOAPAgentMemory {
  currentPlan: GOAPActionDefinition[];
  currentGoalName: string;
  goalPriority: number;
  planIndex: number;
  replanCount: number;
  lastSenseTime: number;
}

const memoryStore = new Map<string, GOAPAgentMemory>();

export class GOAPSteeringEngine {
  public static evaluate(
    npc: NPC,
    player: Player,
    crates: Crate[],
    healStations: HealingStation[],
    nearestHeal: HealingStation | null
  ) {
    let mem = memoryStore.get(npc.id);
    if (!mem) {
      mem = {
        currentPlan: [],
        currentGoalName: 'Evaluating...',
        goalPriority: 0,
        planIndex: 0,
        replanCount: 0,
        lastSenseTime: 0,
      };
      memoryStore.set(npc.id, mem);
    }

    const worldState = GOAPPlanner.senseWorld(npc, player, crates, nearestHeal);

    // Evaluate goals by priority
    const goals = GOAPPlanner.getGoals();
    const sortedGoals = [...goals].sort(
      (a, b) => b.getPriority(npc, worldState) - a.getPriority(npc, worldState)
    );
    const activeGoal = sortedGoals[0];

    // Check if current action is complete or plan needs formulation
    const currentAction = mem.currentPlan[mem.planIndex] || null;
    const shouldReplan =
      !currentAction ||
      mem.currentGoalName !== activeGoal.name ||
      currentAction.isComplete(npc, player, nearestHeal);

    if (shouldReplan) {
      if (currentAction && currentAction.isComplete(npc, player, nearestHeal)) {
        mem.planIndex++;
      }

      if (
        mem.planIndex >= mem.currentPlan.length ||
        mem.currentGoalName !== activeGoal.name
      ) {
        // Generate new plan via A*
        const newPlan = GOAPPlanner.plan(
          worldState,
          activeGoal.desiredState,
          npc,
          player,
          nearestHeal
        );
        if (newPlan && newPlan.length > 0) {
          mem.currentPlan = newPlan;
          mem.planIndex = 0;
          mem.currentGoalName = activeGoal.name;
          mem.goalPriority = activeGoal.getPriority(npc, worldState);
          mem.replanCount++;
        } else {
          // Fallback single action
          mem.currentGoalName = activeGoal.name;
          mem.goalPriority = activeGoal.getPriority(npc, worldState);
        }
      }
    }

    const executingAction = mem.currentPlan[mem.planIndex] || null;
    let targetPt: Vector2 = { x: player.x, y: player.y };
    let actionName = 'Searching Plan...';

    if (executingAction) {
      actionName = executingAction.name;
      targetPt = executingAction.getTargetPoint(npc, player, crates, nearestHeal);
    }

    // Steering computation towards target
    const toTarget = Math2D.sub(targetPt, npc);
    const distToTarget = Math2D.length(toTarget);
    let desiredVel: Vector2 = { x: 0, y: 0 };

    if (distToTarget > 1) {
      let speedMult = executingAction?.name.includes('Melee') ? 1.15 : 1.0;
      if (npc.isExhausted) {
        speedMult = 0.55;
      }
      const speed = npc.maxSpeed * speedMult;
      desiredVel = Math2D.scale(Math2D.normalize(toTarget), speed);
    }

    // Whisker obstacle avoidance with soft exponential repulsion
    let obstacleRepulsion: Vector2 = { x: 0, y: 0 };
    for (const sensor of npc.sensors) {
      if (sensor.isBlocked && sensor.normal) {
        const proximity = Math.max(0, 1 - sensor.hitDistance / sensor.length);
        const weight = proximity * proximity * 360;
        obstacleRepulsion = Math2D.add(
          obstacleRepulsion,
          Math2D.scale(sensor.normal, weight)
        );
      }
    }

    const blendedDesired = Math2D.add(desiredVel, obstacleRepulsion);
    const steeringForce = Math2D.clampLength(
      Math2D.sub(blendedDesired, { x: npc.vx, y: npc.vy }),
      npc.maxForce
    );

    // Build debug state for UI inspector
    const planInfo: GOAPActionInfo[] = mem.currentPlan.map((act, idx) => ({
      name: act.name,
      cost: act.getCost(npc, player, nearestHeal),
      preconditions: act.preconditions,
      effects: act.effects,
      status:
        idx < mem.planIndex
          ? 'completed'
          : idx === mem.planIndex
          ? 'running'
          : 'pending',
    }));

    const totalPlanCost = mem.currentPlan.reduce(
      (sum, a) => sum + a.getCost(npc, player, nearestHeal),
      0
    );

    const debug: GOAPDebugState = {
      currentGoal: activeGoal.name,
      goalPriority: activeGoal.getPriority(npc, worldState),
      worldState,
      plan: planInfo,
      currentActionIndex: mem.planIndex,
      currentActionName: actionName,
      totalPlanCost: Math.round(totalPlanCost * 10) / 10,
      replanCount: mem.replanCount,
    };

    return {
      desiredVelocity: blendedDesired,
      steeringForce,
      targetPoint: targetPt,
      badge: `GOAP: ${actionName}`,
      debug,
    };
  }

  public static clearMemory(id?: string) {
    if (id) {
      memoryStore.delete(id);
    } else {
      memoryStore.clear();
    }
  }
}
