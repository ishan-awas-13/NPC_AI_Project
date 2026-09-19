/**
 * Hierarchical Behavior Tree Engine for Complex NPC Movement.
 * Includes real Selector, Sequence, Condition, and Action nodes with live
 * tick tracking and status reporting for the UI visualizer.
 */

import { Vector2, NPC, Player, Crate, HealingStation, BTNodeSnapshot, BTNodeStatus } from '../types';
import { Math2D } from '../utils/math';

export interface BTExecutionContext {
  npc: NPC;
  player: Player;
  crates: Crate[];
  healStations: HealingStation[];
  nearestHealStation: HealingStation | null;
  // Outputs written by actions
  desiredVelocity: Vector2;
  steeringForce: Vector2;
  targetPoint: Vector2;
  currentActionName: string;
  badge: string;
}

export abstract class BTNode {
  public id: string;
  public name: string;
  public type: 'selector' | 'sequence' | 'action' | 'condition';
  public description: string;
  public lastStatus: BTNodeStatus = 'INACTIVE';
  public children: BTNode[] = [];

  constructor(
    id: string,
    name: string,
    type: 'selector' | 'sequence' | 'action' | 'condition',
    description: string,
    children: BTNode[] = []
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.description = description;
    this.children = children;
  }

  public abstract tick(context: BTExecutionContext, activePath: string[]): BTNodeStatus;

  public getSnapshot(): BTNodeSnapshot {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.lastStatus,
      description: this.description,
      children: this.children.map((c) => c.getSnapshot()),
    };
  }

  public resetStatus() {
    this.lastStatus = 'INACTIVE';
    for (const c of this.children) {
      c.resetStatus();
    }
  }
}

/**
 * Selector Node: ticks children sequentially until one returns SUCCESS or RUNNING.
 */
export class SelectorNode extends BTNode {
  constructor(id: string, name: string, description: string, children: BTNode[]) {
    super(id, name, 'selector', description, children);
  }

  public tick(context: BTExecutionContext, activePath: string[]): BTNodeStatus {
    activePath.push(this.id);
    for (const child of this.children) {
      const status = child.tick(context, activePath);
      if (status === 'RUNNING' || status === 'SUCCESS') {
        this.lastStatus = status;
        return status;
      }
    }
    this.lastStatus = 'FAILURE';
    return 'FAILURE';
  }
}

/**
 * Sequence Node: ticks children sequentially until one returns FAILURE or RUNNING.
 */
export class SequenceNode extends BTNode {
  constructor(id: string, name: string, description: string, children: BTNode[]) {
    super(id, name, 'sequence', description, children);
  }

  public tick(context: BTExecutionContext, activePath: string[]): BTNodeStatus {
    activePath.push(this.id);
    for (const child of this.children) {
      const status = child.tick(context, activePath);
      if (status === 'FAILURE' || status === 'RUNNING') {
        this.lastStatus = status;
        return status;
      }
    }
    this.lastStatus = 'SUCCESS';
    return 'SUCCESS';
  }
}

/**
 * Condition Node: evaluates a predicate function.
 */
export class ConditionNode extends BTNode {
  private predicate: (context: BTExecutionContext) => boolean;

  constructor(
    id: string,
    name: string,
    description: string,
    predicate: (context: BTExecutionContext) => boolean
  ) {
    super(id, name, 'condition', description);
    this.predicate = predicate;
  }

  public tick(context: BTExecutionContext, activePath: string[]): BTNodeStatus {
    activePath.push(this.id);
    const pass = this.predicate(context);
    this.lastStatus = pass ? 'SUCCESS' : 'FAILURE';
    return this.lastStatus;
  }
}

/**
 * Action Node: executes motion or game behavior.
 */
export class ActionNode extends BTNode {
  private executeFn: (context: BTExecutionContext) => BTNodeStatus;

  constructor(
    id: string,
    name: string,
    description: string,
    executeFn: (context: BTExecutionContext) => BTNodeStatus
  ) {
    super(id, name, 'action', description);
    this.executeFn = executeFn;
  }

  public tick(context: BTExecutionContext, activePath: string[]): BTNodeStatus {
    activePath.push(this.id);
    const status = this.executeFn(context);
    this.lastStatus = status;
    return status;
  }
}

/**
 * Factory for building the NPC Complex Movement Behavior Tree.
 */
export function createComplexMovementBehaviorTree(): BTNode {
  return new SelectorNode('root_selector', 'Root Priority Selector', 'Evaluate high-level goal: Survival vs Ambush vs Chase', [
    // Branch 1: Self-Preservation & Healing Sequence
    new SequenceNode('seq_heal', 'Heal & Recover Sequence', 'Seek healing station when health is critically low', [
      new ConditionNode('cond_health_low', 'Is Health < 35%?', 'Check if HP is below safety threshold or actively healing', (ctx) => {
        // If already healing, remain in healing mode until HP >= 80%
        if (ctx.npc.isHealing && ctx.npc.health < ctx.npc.maxHealth * 0.8) {
          return true;
        }
        return ctx.npc.health <= ctx.npc.maxHealth * 0.35;
      }),
      new ActionNode('act_navigate_heal', 'Navigate to Heal Station', 'Compute obstacle-avoiding steering towards healing zone', (ctx) => {
        if (!ctx.nearestHealStation) return 'FAILURE';

        const healCenter = {
          x: ctx.nearestHealStation.x + ctx.nearestHealStation.width / 2,
          y: ctx.nearestHealStation.y + ctx.nearestHealStation.height / 2,
        };
        ctx.targetPoint = healCenter;

        const distToStation = Math2D.dist({ x: ctx.npc.x, y: ctx.npc.y }, healCenter);

        // Check if inside healing station
        const isInside = Math2D.pointInAABB(
          { x: ctx.npc.x, y: ctx.npc.y },
          ctx.nearestHealStation,
          ctx.npc.size / 2
        );

        if (isInside) {
          ctx.currentActionName = 'Rest & Regenerate in Heal Shrine';
          ctx.badge = 'BT: Regenerating';
          // Slow down and stay inside shrine
          const desired = Math2D.scale({ x: ctx.npc.vx, y: ctx.npc.vy }, 0.1);
          ctx.desiredVelocity = desired;
          ctx.steeringForce = Math2D.sub(desired, { x: ctx.npc.vx, y: ctx.npc.vy });
          return 'RUNNING';
        }

        ctx.currentActionName = 'Retreating to Heal Station';
        ctx.badge = 'BT: Flee to Heal';

        // Calculate heading to heal station with feeler avoidance
        const toHeal = Math2D.normalize(Math2D.sub(healCenter, { x: ctx.npc.x, y: ctx.npc.y }));
        let avoidForce: Vector2 = { x: 0, y: 0 };

        for (const sensor of ctx.npc.sensors) {
          if (sensor.isBlocked && sensor.hitDistance > 0) {
            const urgency = Math.pow(1 - sensor.hitDistance / sensor.length, 1.8);
            if (sensor.normal) {
              avoidForce = Math2D.add(avoidForce, Math2D.scale(sensor.normal, urgency * 2.2));
            } else {
              const sensorHeading = ctx.npc.rotation + sensor.angleOffset;
              const sensorDir = Math2D.headingToVec(sensorHeading);
              avoidForce = Math2D.sub(avoidForce, Math2D.scale(sensorDir, urgency * 1.8));
            }
          }
        }

        let combinedDir = toHeal;
        if (Math2D.length(avoidForce) > 0.05) {
          combinedDir = Math2D.normalize(Math2D.add(combinedDir, avoidForce));
        }

        // Boost retreat speed by 1.25x for urgent survival
        const desiredSpeed = ctx.npc.maxSpeed * 1.25;
        ctx.desiredVelocity = Math2D.scale(combinedDir, desiredSpeed);
        ctx.steeringForce = Math2D.clampLength(
          Math2D.sub(ctx.desiredVelocity, { x: ctx.npc.vx, y: ctx.npc.vy }),
          ctx.npc.maxForce * 1.4
        );

        return 'RUNNING';
      }),
    ]),

    // Branch 2: Exhaustion & Stamina Recovery Sequence
    new SequenceNode('seq_exhaustion_recovery', 'Fatigue Recovery Sequence', 'Back off and catch breath when stamina is fully depleted', [
      new ConditionNode('cond_is_exhausted', 'Is Agent Exhausted?', 'Check if NPC has depleted aggression stamina', (ctx) => {
        return !!ctx.npc.isExhausted;
      }),
      new ActionNode('act_catch_breath', 'Disengage & Catch Breath', 'Maintain standoff distance and slow down to catch breath', (ctx) => {
        const npcPos = { x: ctx.npc.x, y: ctx.npc.y };
        const playerPos = { x: ctx.player.x, y: ctx.player.y };
        const distToPlayer = Math2D.dist(npcPos, playerPos);

        ctx.currentActionName = 'Catching Breath (Exhausted)';
        ctx.badge = `BT: Tired (${Math.ceil(ctx.npc.aggressionStamina ?? 0)}s)`;

        // If player is too close (< 180px), back off; if farther, circle/loiter at tired pace
        let moveDir: Vector2;
        if (distToPlayer < 180) {
          // Back off away from player
          moveDir = Math2D.normalize(Math2D.sub(npcPos, playerPos));
        } else {
          // Tactical orbit or gentle standoff
          const tangent = { x: -(playerPos.y - npcPos.y), y: playerPos.x - npcPos.x };
          moveDir = Math2D.normalize(tangent);
        }

        // Whisker obstacle avoidance during retreat
        let avoidForce: Vector2 = { x: 0, y: 0 };
        for (const sensor of ctx.npc.sensors) {
          if (sensor.isBlocked && sensor.hitDistance > 0) {
            const urgency = Math.pow(1 - sensor.hitDistance / sensor.length, 2);
            if (sensor.normal) {
              avoidForce = Math2D.add(avoidForce, Math2D.scale(sensor.normal, urgency * 2.5));
            }
          }
        }
        if (Math2D.length(avoidForce) > 0.05) {
          moveDir = Math2D.normalize(Math2D.add(moveDir, avoidForce));
        }

        // Tired trot: only 55% speed, gentle steering
        const tiredSpeed = ctx.npc.maxSpeed * 0.55;
        ctx.targetPoint = Math2D.add(npcPos, Math2D.scale(moveDir, 120));
        ctx.desiredVelocity = Math2D.scale(moveDir, tiredSpeed);
        ctx.steeringForce = Math2D.clampLength(
          Math2D.sub(ctx.desiredVelocity, { x: ctx.npc.vx, y: ctx.npc.vy }),
          ctx.npc.maxForce * 0.7
        );

        return 'RUNNING';
      }),
    ]),

    // Branch 3: Tactical Obstacle Clearance & Corner Flank Sequence
    new SequenceNode('seq_tactical_cover', 'Obstacle Cornering Sequence', 'When player hides behind crate, steer around corner to flank', [
      new ConditionNode('cond_player_blocked', 'Player Behind Cover?', 'Check if direct line of sight to player is occluded by crate', (ctx) => {
        const npcPos = { x: ctx.npc.x, y: ctx.npc.y };
        const playerPos = { x: ctx.player.x, y: ctx.player.y };
        return !Math2D.hasLineOfSight(npcPos, playerPos, ctx.crates);
      }),
      new ActionNode('act_corner_flank', 'Navigate Around Crate Corner', 'Find nearest clear corner of obstructing crate and path towards it', (ctx) => {
        const npcPos = { x: ctx.npc.x, y: ctx.npc.y };
        const playerPos = { x: ctx.player.x, y: ctx.player.y };

        // Find the obstructing crate closest to NPC
        let obstructingCrate: Crate | null = null;
        let minHitDist = Infinity;
        const toPlayer = Math2D.sub(playerPos, npcPos);
        const dist = Math2D.length(toPlayer);
        const dir = Math2D.scale(toPlayer, 1 / dist);

        for (const crate of ctx.crates) {
          const hit = Math2D.rayIntersectAABB(npcPos, dir, dist, crate);
          if (hit.hit && hit.distance < minHitDist) {
            minHitDist = hit.distance;
            obstructingCrate = crate;
          }
        }

        if (!obstructingCrate) return 'FAILURE';

        // Evaluate 4 corners of the crate with offset margin
        const margin = ctx.npc.size * 1.4;
        const corners: Vector2[] = [
          { x: obstructingCrate.x - margin, y: obstructingCrate.y - margin },
          { x: obstructingCrate.x + obstructingCrate.width + margin, y: obstructingCrate.y - margin },
          { x: obstructingCrate.x - margin, y: obstructingCrate.y + obstructingCrate.height + margin },
          { x: obstructingCrate.x + obstructingCrate.width + margin, y: obstructingCrate.y + obstructingCrate.height + margin },
        ];

        // Pick corner with lowest total distance (NPC -> Corner -> Player)
        let bestCorner = corners[0];
        let bestCost = Infinity;
        for (const corner of corners) {
          const cost = Math2D.dist(npcPos, corner) + Math2D.dist(corner, playerPos);
          if (cost < bestCost) {
            bestCost = cost;
            bestCorner = corner;
          }
        }

        ctx.targetPoint = bestCorner;
        ctx.currentActionName = 'Tactical Crate Corner Flank';
        ctx.badge = 'BT: Flank Cover';

        const toCorner = Math2D.normalize(Math2D.sub(bestCorner, npcPos));
        let avoidForce: Vector2 = { x: 0, y: 0 };
        for (const s of ctx.npc.sensors) {
          if (s.isBlocked && s.hitDistance < 60) {
            avoidForce = Math2D.add(avoidForce, Math2D.scale(s.normal || { x: 0, y: 0 }, 1.5));
          }
        }

        const moveDir = Math2D.normalize(Math2D.add(toCorner, avoidForce));
        ctx.desiredVelocity = Math2D.scale(moveDir, ctx.npc.maxSpeed * 1.05);
        ctx.steeringForce = Math2D.clampLength(
          Math2D.sub(ctx.desiredVelocity, { x: ctx.npc.vx, y: ctx.npc.vy }),
          ctx.npc.maxForce * 1.2
        );

        return 'RUNNING';
      }),
    ]),

    // Branch 3: Multi-Whisker Predictive Pursuit Action
    new ActionNode('act_whisker_chase', 'Predictive Whisker Chase', 'Steer directly towards predicted player pos with 5-ray feeler avoidance', (ctx) => {
      const npcPos = { x: ctx.npc.x, y: ctx.npc.y };
      const playerPos = { x: ctx.player.x, y: ctx.player.y };
      const playerVel = { x: ctx.player.vx, y: ctx.player.vy };

      // Predictive intercept
      const dist = Math2D.dist(npcPos, playerPos);
      const leadTime = Math.min(0.8, dist / (ctx.npc.maxSpeed + 1));
      const predictedPos = Math2D.add(playerPos, Math2D.scale(playerVel, leadTime * 12));
      ctx.targetPoint = predictedPos;

      ctx.currentActionName = 'Predictive Whisker Chase';
      ctx.badge = 'BT: Whisker Chase';

      const directTarget = Math2D.normalize(Math2D.sub(predictedPos, npcPos));

      // Whisker avoidance
      let whiskerAvoidForce: Vector2 = { x: 0, y: 0 };
      let urgentHit = false;

      for (const sensor of ctx.npc.sensors) {
        if (sensor.isBlocked && sensor.hitDistance > 0) {
          const ratio = sensor.hitDistance / sensor.length;
          const urgency = Math.pow(1 - ratio, 2);
          if (ratio < 0.4) urgentHit = true;

          // Strongly deflect away from the blocked whisker
          if (sensor.normal) {
            whiskerAvoidForce = Math2D.add(whiskerAvoidForce, Math2D.scale(sensor.normal, urgency * 2.8));
          } else {
            const angle = ctx.npc.rotation + sensor.angleOffset;
            whiskerAvoidForce = Math2D.sub(whiskerAvoidForce, Math2D.scale(Math2D.headingToVec(angle), urgency * 2.2));
          }
        }
      }

      let finalHeading = directTarget;
      if (Math2D.length(whiskerAvoidForce) > 0.05) {
        finalHeading = Math2D.normalize(Math2D.add(directTarget, whiskerAvoidForce));
      }

      const speed = urgentHit ? ctx.npc.maxSpeed * 0.85 : ctx.npc.maxSpeed * 1.1;
      ctx.desiredVelocity = Math2D.scale(finalHeading, speed);
      ctx.steeringForce = Math2D.clampLength(
        Math2D.sub(ctx.desiredVelocity, { x: ctx.npc.vx, y: ctx.npc.vy }),
        ctx.npc.maxForce * 1.3
      );

      return 'RUNNING';
    }),
  ]);
}
