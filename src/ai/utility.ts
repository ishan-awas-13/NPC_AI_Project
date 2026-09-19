/**
 * Utility AI Control System:
 * Evaluates continuous mathematical response curves (Exponential, Logistic, Quadratic)
 * across competing considerations (Survival Need, Combat Opportunity, Tactical Positioning)
 * and selects the optimal action with inertia-damped hysteresis.
 */

import { Vector2, NPC, Player, Crate, HealingStation, UtilityAIDebugState, UtilityScoreInfo } from '../types';
import { Math2D } from '../utils/math';

export interface UtilityAction {
  name: string;
  description: string;
  curveType: 'Exponential' | 'Logistic (Sigmoid)' | 'Quadratic' | 'Linear';
  weight: number;
  evaluateUtility: (
    npc: NPC,
    player: Player,
    crates: Crate[],
    nearestHeal: HealingStation | null,
    hasLOS: boolean,
    distToPlayer: number
  ) => number;
  getTargetAndSpeed: (
    npc: NPC,
    player: Player,
    crates: Crate[],
    nearestHeal: HealingStation | null
  ) => { target: Vector2; speed: number };
}

interface UtilityAgentMemory {
  currentAction: string;
  inertiaTimer: number; // Prevent high frequency action flickering
  inertiaBonus: number;
}

const utilityMemoryStore = new Map<string, UtilityAgentMemory>();

export class UtilityAIEngine {
  private static actions: UtilityAction[] = [
    {
      name: 'Emergency Heal Station Retreat',
      description: 'Exponential curve driven by missing health and shrine proximity',
      curveType: 'Exponential',
      weight: 1.25,
      evaluateUtility: (npc, _player, _crates, nearestHeal, _hasLOS) => {
        const hpRatio = Math.max(0, npc.health / npc.maxHealth);
        // Exponential urgency: (1 - hp)^2.2
        const healthUrgency = Math.pow(Math.max(0, 1 - hpRatio), 2.2);

        // Distance factor to nearest heal station
        let distFactor = 0.9;
        if (nearestHeal) {
          const d = Math2D.dist(npc, {
            x: nearestHeal.x + nearestHeal.width / 2,
            y: nearestHeal.y + nearestHeal.height / 2,
          });
          distFactor = Math.max(0.4, 1 - d / 800);
        }

        // If currently healing inside shrine and not full, sustain high priority
        if (npc.isHealing && hpRatio < 0.85) {
          return 0.95;
        }

        return Math.min(1.0, healthUrgency * 1.4 * distFactor);
      },
      getTargetAndSpeed: (npc, _player, _crates, nearestHeal) => {
        if (!nearestHeal) return { target: { x: npc.x, y: npc.y }, speed: 0 };
        return {
          target: {
            x: nearestHeal.x + nearestHeal.width / 2,
            y: nearestHeal.y + nearestHeal.height / 2,
          },
          speed: npc.maxSpeed * 1.1,
        };
      },
    },
    {
      name: 'Tactical Corner Flank',
      description: 'Logistic sigmoid curve activated when crates break line-of-sight',
      curveType: 'Logistic (Sigmoid)',
      weight: 1.0,
      evaluateUtility: (npc, _player, _crates, _nearestHeal, hasLOS, distToPlayer) => {
        if (hasLOS) return 0.05; // No need to flank if we already see the player
        if (npc.health <= 35) return 0.1; // Heal is more important

        // Logistic curve on distance: 1 / (1 + e^(-k*(d - x0)))
        const normalizedDist = distToPlayer / 400;
        const sigmoid = 1 / (1 + Math.exp(-6 * (normalizedDist - 0.3)));
        const healthFactor = npc.health / npc.maxHealth;

        return Math.min(1.0, 0.82 * sigmoid * healthFactor);
      },
      getTargetAndSpeed: (npc, player, crates) => {
        const blockingCrate = crates.find((c) =>
          !Math2D.hasLineOfSight(npc, player, [c])
        );
        if (!blockingCrate) return { target: { x: player.x, y: player.y }, speed: npc.maxSpeed };

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
        return { target: bestCorner, speed: npc.maxSpeed * 1.05 };
      },
    },
    {
      name: 'Predictive Velocity Intercept',
      description: 'Linear response curve for medium/long distance target pursuit',
      curveType: 'Linear',
      weight: 1.0,
      evaluateUtility: (npc, player, _crates, _nearestHeal, hasLOS, distToPlayer) => {
        if (!hasLOS) return 0.15;
        if (npc.health <= 35) return 0.1;

        // Peak utility at 150-350px range with line of sight
        const dNorm = Math2D.clamp(distToPlayer / 350, 0, 1);
        const playerSpeed = Math.hypot(player.vx, player.vy);
        const motionBonus = Math.min(0.25, playerSpeed / 400);

        return Math.min(0.95, (0.45 + 0.35 * dNorm + motionBonus) * (npc.health / 100));
      },
      getTargetAndSpeed: (npc, player) => {
        const d = Math2D.dist(npc, player);
        const lead = Math.min(0.4, d / 450);
        return {
          target: {
            x: player.x + player.vx * lead,
            y: player.y + player.vy * lead,
          },
          speed: npc.maxSpeed,
        };
      },
    },
    {
      name: 'High-Aggression Melee Pounce',
      description: 'Quadratic proximity curve when player is within striking distance',
      curveType: 'Quadratic',
      weight: 1.15,
      evaluateUtility: (npc, _player, _crates, _nearestHeal, hasLOS, distToPlayer) => {
        if (!hasLOS || distToPlayer > 180) return 0.05;
        if (npc.health <= 35) return 0.05;
        if (npc.isExhausted || (npc.aggressionStamina !== undefined && npc.aggressionStamina <= 0.2)) {
          return 0.02; // Too exhausted to pounce/sprint
        }

        // Quadratic dropoff: (1 - d / 180)^2
        const proximity = Math.max(0, 1 - distToPlayer / 180);
        const quad = proximity * proximity;
        const healthConfidence = Math.pow(npc.health / 100, 1.2);
        const staminaFactor = Math.max(0.2, (npc.aggressionStamina ?? 4.0) / (npc.maxAggressionStamina ?? 4.0));

        return Math.min(1.0, quad * 0.95 * healthConfidence * staminaFactor);
      },
      getTargetAndSpeed: (npc, player) => {
        // If exhausted, speed drops to tired trot (0.75x) instead of turbo 1.2x
        const speedMult = npc.isExhausted ? 0.75 : 1.15;
        return {
          target: { x: player.x, y: player.y },
          speed: npc.maxSpeed * speedMult,
        };
      },
    },
  ];

  public static evaluate(
    npc: NPC,
    player: Player,
    crates: Crate[],
    healStations: HealingStation[],
    nearestHeal: HealingStation | null
  ) {
    let mem = utilityMemoryStore.get(npc.id);
    if (!mem) {
      mem = {
        currentAction: this.actions[0].name,
        inertiaTimer: 0,
        inertiaBonus: 0.12, // 12% bonus to current action to avoid micro-jitter
      };
      utilityMemoryStore.set(npc.id, mem);
    }

    const distToPlayer = Math2D.dist(npc, player);
    const hasLOS = Math2D.hasLineOfSight(npc, player, crates);

    // Calculate utility scores for all actions
    const scores: UtilityScoreInfo[] = this.actions.map((act) => {
      let rawScore = act.evaluateUtility(
        npc,
        player,
        crates,
        nearestHeal,
        hasLOS,
        distToPlayer
      );
      rawScore *= act.weight;

      // Apply inertia bonus if this was the previously executing action
      const isCurrent = act.name === mem?.currentAction;
      const finalScore = Math.min(1.0, isCurrent ? rawScore + (mem?.inertiaBonus || 0) : rawScore);

      return {
        actionName: act.name,
        score: Math.round(finalScore * 100) / 100,
        curveType: act.curveType,
        weight: act.weight,
        isActive: false,
        description: act.description,
      };
    });

    // Select action with highest utility score
    scores.sort((a, b) => b.score - a.score);
    const winningActionInfo = scores[0];
    winningActionInfo.isActive = true;

    mem.currentAction = winningActionInfo.actionName;

    const activeAction = this.actions.find((a) => a.name === winningActionInfo.actionName)!;
    const { target, speed } = activeAction.getTargetAndSpeed(npc, player, crates, nearestHeal);

    // Desired velocity towards target
    const toTarget = Math2D.sub(target, npc);
    const d = Math2D.length(toTarget);
    let desiredVel: Vector2 = { x: 0, y: 0 };
    if (d > 2) {
      desiredVel = Math2D.scale(Math2D.normalize(toTarget), speed);
    }

    // Whisker obstacle avoidance
    let obstacleRepulsion: Vector2 = { x: 0, y: 0 };
    for (const sensor of npc.sensors) {
      if (sensor.isBlocked && sensor.normal) {
        const proximity = Math.max(0, 1 - sensor.hitDistance / sensor.length);
        const weight = proximity * proximity * 380;
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

    const debug: UtilityAIDebugState = {
      scores,
      selectedAction: winningActionInfo.actionName,
      highestUtility: winningActionInfo.score,
      inertiaTimer: mem.inertiaTimer,
    };

    return {
      desiredVelocity: blendedDesired,
      steeringForce,
      targetPoint: target,
      badge: `Utility: ${winningActionInfo.actionName.split(' ')[0]}`,
      debug,
    };
  }

  public static clearMemory(id?: string) {
    if (id) {
      utilityMemoryStore.delete(id);
    } else {
      utilityMemoryStore.clear();
    }
  }
}
