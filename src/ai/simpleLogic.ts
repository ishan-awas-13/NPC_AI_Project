/**
 * Simple Decision Logic / Finite State Machine AI Steering Engine.
 * Uses hard if-else branch conditions for basic, direct chasing and retreat movements.
 */

import { Vector2, NPC, Player, Crate, HealingStation, SimpleLogicState } from '../types';
import { Math2D } from '../utils/math';

export class SimpleDecisionEngine {
  public static evaluate(
    npc: NPC,
    player: Player,
    crates: Crate[],
    healStations: HealingStation[],
    nearestHealStation: HealingStation | null
  ): {
    desiredVelocity: Vector2;
    steeringForce: Vector2;
    targetPoint: Vector2;
    debug: SimpleLogicState;
    badge: string;
  } {
    const npcPos = { x: npc.x, y: npc.y };
    const playerPos = { x: player.x, y: player.y };
    const healthPercent = (npc.health / npc.maxHealth) * 100;

    let currentState: 'DIRECT_CHASE' | 'FLEE_TO_HEAL' | 'OBSTACLE_SLIDE' | 'EXHAUSTED_STANDOFF' = 'DIRECT_CHASE';
    let reason = '';
    let targetPoint = playerPos;
    let badge = 'SIMPLE: Chase';

    // Hard Decision Rule 1: Health check
    if (healthPercent <= 30 || (npc.isHealing && healthPercent < 75)) {
      currentState = 'FLEE_TO_HEAL';
      reason = `Health low (${Math.round(healthPercent)}% <= 30%), fleeing to heal station`;
      badge = 'SIMPLE: Flee (Low HP)';

      if (nearestHealStation) {
        targetPoint = {
          x: nearestHealStation.x + nearestHealStation.width / 2,
          y: nearestHealStation.y + nearestHealStation.height / 2,
        };
      }
    } else if (npc.isExhausted) {
      // Hard Decision Rule 2: Exhaustion check - disengage and catch breath
      currentState = 'EXHAUSTED_STANDOFF';
      reason = `Exhausted (${Math.ceil(npc.aggressionStamina ?? 0)}s). Backing off to catch breath.`;
      badge = `SIMPLE: Tired (${Math.ceil(npc.aggressionStamina ?? 0)}s)`;

      // Stand off 180px away from player
      const awayDir = Math2D.normalize(Math2D.sub(npcPos, playerPos));
      targetPoint = Math2D.add(npcPos, Math2D.scale(awayDir, 140));
    } else {
      currentState = 'DIRECT_CHASE';
      reason = `Health normal (${Math.round(healthPercent)}% > 30%), direct pursuit to player`;
      badge = 'SIMPLE: Direct Chase';
      targetPoint = playerPos;
    }

    // Direct heading towards target
    const toTarget = Math2D.sub(targetPoint, npcPos);
    let targetDir = Math2D.normalize(toTarget);

    // Simple single-feeler obstacle collision reaction (naive wall slide)
    let obstacleDetected = false;
    // Check center forward sensor
    const centerSensor = npc.sensors.find((s) => Math.abs(s.angleOffset) < 0.05) || npc.sensors[0];

    if (centerSensor && centerSensor.isBlocked && centerSensor.hitDistance < 50) {
      obstacleDetected = true;
      currentState = 'OBSTACLE_SLIDE';
      reason = `Obstacle detected at ${Math.round(centerSensor.hitDistance)}px. Applying naive tangent slide.`;
      badge = 'SIMPLE: Wall Slide';

      if (centerSensor.normal) {
        // Tangent slide: project targetDir onto the wall tangent (perpendicular to normal)
        const n = centerSensor.normal;
        // Tangent is (-n.y, n.x) or (n.y, -n.x), pick the one aligned with targetDir
        const t1: Vector2 = { x: -n.y, y: n.x };
        const t2: Vector2 = { x: n.y, y: -n.x };
        const dot1 = Math2D.dot(targetDir, t1);
        const dot2 = Math2D.dot(targetDir, t2);
        const chosenTangent = dot1 >= dot2 ? t1 : t2;

        // Blend tangent with a small normal push outward
        targetDir = Math2D.normalize(Math2D.add(chosenTangent, Math2D.scale(n, 0.4)));
      } else {
        // Rotate 90 degrees as simple avoidance
        targetDir = Math2D.rotateVec(targetDir, Math.PI / 2);
      }
    }

    // Direct velocity calculation
    let speed = npc.maxSpeed * 0.95;
    if (currentState === 'FLEE_TO_HEAL') {
      speed = npc.maxSpeed * 1.15;
    } else if (currentState === 'EXHAUSTED_STANDOFF') {
      speed = npc.maxSpeed * 0.55;
    }
    const desiredVelocity = Math2D.scale(targetDir, speed);

    // Direct steering force
    const currentVelocity = { x: npc.vx, y: npc.vy };
    let steeringForce = Math2D.sub(desiredVelocity, currentVelocity);
    steeringForce = Math2D.clampLength(steeringForce, npc.maxForce * 1.1);

    const debug: SimpleLogicState = {
      currentState,
      reason,
      targetPoint,
      obstacleDetected,
    };

    return {
      desiredVelocity,
      steeringForce,
      targetPoint,
      debug,
      badge,
    };
  }
}
