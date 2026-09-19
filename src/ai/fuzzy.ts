/**
 * Fuzzy Logic AI Steering Engine for NPCs.
 * Uses continuous membership functions (triangular/trapezoidal) and rule-based
 * defuzzification to generate fluid, context-aware steering forces.
 */

import { Vector2, NPC, Player, Crate, HealingStation, FuzzyMembershipState } from '../types';
import { Math2D } from '../utils/math';

// Fuzzy Membership Function Helpers
function trimf(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

function trapmf(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

export class FuzzySteeringEngine {
  /**
   * Evaluate fuzzy logic for an NPC given game context.
   */
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
    debug: FuzzyMembershipState;
    badge: string;
  } {
    const npcPos = { x: npc.x, y: npc.y };
    const playerPos = { x: player.x, y: player.y };
    const distToPlayer = Math2D.dist(npcPos, playerPos);
    const healthPercent = (npc.health / npc.maxHealth) * 100;

    // 1. Calculate Membership Degrees
    // Distance Membership (0 - 450px)
    const distNear = trapmf(distToPlayer, 0, 0, 90, 170);
    const distMed = trimf(distToPlayer, 110, 210, 310);
    const distFar = trapmf(distToPlayer, 250, 340, 9999, 9999);

    // Health Membership (0 - 100%)
    const healthLow = trapmf(healthPercent, 0, 0, 25, 45);
    const healthMed = trimf(healthPercent, 30, 55, 75);
    const healthHigh = trapmf(healthPercent, 60, 80, 100, 100);

    // Obstacle Danger (evaluate based on forward sensor readings)
    let minSensorDist = 120;
    for (const s of npc.sensors) {
      if (s.isBlocked && s.hitDistance < minSensorDist) {
        minSensorDist = s.hitDistance;
      }
    }
    const obstacleDanger = trapmf(minSensorDist, 0, 0, 45, 110);

    // 2. Fuzzy Rule Inference
    // Rule 1: IF Health is Low -> Goal: RETREAT & HEAL
    const wRetreat = healthLow;

    // Rule 2: IF Health is Med AND Distance is Near -> Goal: CAUTIOUS FLANK / ORBIT
    const wFlank = Math.min(healthMed, distNear);

    // Rule 3: IF Health is Med AND Distance is Med/Far -> Goal: BALANCED CHASE
    const wBalancedChase = Math.min(healthMed, Math.max(distMed, distFar));

    // Rule 4: IF Health is High AND Distance is Far -> Goal: AGGRESSIVE PURSUIT (lead target)
    const wAggressiveChase = Math.min(healthHigh, distFar);

    // Rule 5: IF Health is High AND Distance is Near -> Goal: RELENTLESS RAM
    const wRelentless = Math.min(healthHigh, Math.max(distNear, distMed));

    // Calculate component vectors
    // A) Pursuit Vector (Direct or Lead Target)
    const playerVel = { x: player.vx, y: player.vy };
    const lookAheadTime = Math.min(1.2, distToPlayer / (npc.maxSpeed + 1));
    const predictedPlayerPos = Math2D.add(playerPos, Math2D.scale(playerVel, lookAheadTime * 15));
    const dirToPredicted = Math2D.normalize(Math2D.sub(predictedPlayerPos, npcPos));
    const directChaseDir = Math2D.normalize(Math2D.sub(playerPos, npcPos));

    // B) Flank Vector (circle around player perpendicularly)
    const toPlayer = Math2D.sub(playerPos, npcPos);
    // Perpendicular vector (-y, x)
    const perpDir = Math2D.normalize({ x: -toPlayer.y, y: toPlayer.x });
    // Blend with slight push outward to maintain comfortable combat distance (approx 140px)
    const radialPush = distToPlayer < 140 ? -0.5 : 0.2;
    const flankDir = Math2D.normalize(Math2D.add(perpDir, Math2D.scale(directChaseDir, radialPush)));

    // C) Heal Vector (seek nearest heal station)
    let healDir: Vector2 = { x: -directChaseDir.x, y: -directChaseDir.y }; // fallback away from player
    let targetHealPoint: Vector2 = playerPos;
    if (nearestHealStation) {
      const healCenter = {
        x: nearestHealStation.x + nearestHealStation.width / 2,
        y: nearestHealStation.y + nearestHealStation.height / 2,
      };
      targetHealPoint = healCenter;
      healDir = Math2D.normalize(Math2D.sub(healCenter, npcPos));
    }

    // D) Raycast Whisker Obstacle Repulsion Force
    let obstacleAvoidanceForce: Vector2 = { x: 0, y: 0 };
    for (const sensor of npc.sensors) {
      if (sensor.isBlocked && sensor.hitDistance > 0) {
        const repulsionStrength = Math.pow(1 - sensor.hitDistance / sensor.length, 2);
        if (sensor.normal) {
          // Push away along crate normal
          obstacleAvoidanceForce = Math2D.add(
            obstacleAvoidanceForce,
            Math2D.scale(sensor.normal, repulsionStrength * 2.5)
          );
        } else {
          // Push opposite to ray sensor
          const sensorHeading = npc.rotation + sensor.angleOffset;
          const sensorDir = Math2D.headingToVec(sensorHeading);
          obstacleAvoidanceForce = Math2D.sub(
            obstacleAvoidanceForce,
            Math2D.scale(sensorDir, repulsionStrength * 2.0)
          );
        }
      }
    }

    // 3. Defuzzification (Weighted Blending of vectors)
    let blendedDir: Vector2 = { x: 0, y: 0 };
    let totalWeight = 0;

    // Blend rules
    if (wRetreat > 0.01) {
      blendedDir = Math2D.add(blendedDir, Math2D.scale(healDir, wRetreat * 1.6));
      totalWeight += wRetreat * 1.6;
    }
    if (wFlank > 0.01) {
      blendedDir = Math2D.add(blendedDir, Math2D.scale(flankDir, wFlank * 1.1));
      totalWeight += wFlank * 1.1;
    }
    if (wBalancedChase > 0.01) {
      blendedDir = Math2D.add(blendedDir, Math2D.scale(directChaseDir, wBalancedChase * 1.0));
      totalWeight += wBalancedChase * 1.0;
    }
    if (wAggressiveChase > 0.01) {
      blendedDir = Math2D.add(blendedDir, Math2D.scale(dirToPredicted, wAggressiveChase * 1.3));
      totalWeight += wAggressiveChase * 1.3;
    }
    if (wRelentless > 0.01) {
      blendedDir = Math2D.add(blendedDir, Math2D.scale(directChaseDir, wRelentless * 1.4));
      totalWeight += wRelentless * 1.4;
    }

    // If total weight is too small, default to direct chase
    if (totalWeight < 0.05) {
      blendedDir = directChaseDir;
    } else {
      blendedDir = Math2D.scale(blendedDir, 1 / totalWeight);
    }

    // Strongly inject obstacle avoidance into defuzzified heading
    if (Math2D.length(obstacleAvoidanceForce) > 0.05) {
      blendedDir = Math2D.normalize(
        Math2D.add(blendedDir, Math2D.scale(obstacleAvoidanceForce, 1.4 + obstacleDanger * 1.5))
      );
    } else {
      blendedDir = Math2D.normalize(blendedDir);
    }

    // Speed multiplier calculation via fuzzy inference:
    // Aggressive pursuit has speed boost ONLY if stamina remains; exhausted NPCs slow down
    const staminaRatio = (npc.aggressionStamina ?? 4.0) / (npc.maxAggressionStamina ?? 4.0);
    const sprintBoost = npc.isExhausted ? -0.2 : (wAggressiveChase * 0.35 * staminaRatio);
    const baseSpeedMult = 0.85 + sprintBoost + (wRetreat * 0.4) - (wFlank * 0.15);
    const speedMultiplier = Math2D.clamp(baseSpeedMult, 0.70, 1.3);

    const targetSpeed = npc.maxSpeed * speedMultiplier;
    const desiredVelocity = Math2D.scale(blendedDir, targetSpeed);

    // Reynolds Steering force: Steering = Desired - Velocity
    const currentVelocity = { x: npc.vx, y: npc.vy };
    let steeringForce = Math2D.sub(desiredVelocity, currentVelocity);
    steeringForce = Math2D.clampLength(steeringForce, npc.maxForce * 1.3);

    // Primary target point for visualizer
    const targetPoint = wRetreat > 0.4 ? targetHealPoint : (wAggressiveChase > 0.4 ? predictedPlayerPos : playerPos);

    // Active goal determination for badge & debugging
    let primaryGoal = 'Balanced Chase';
    let badge = 'FUZZY: Chase';
    if (wRetreat > 0.4) {
      primaryGoal = 'Emergency Retreat (Flee to Heal)';
      badge = `FUZZY: Flee (${(wRetreat * 100).toFixed(0)}%)`;
    } else if (wFlank > 0.4) {
      primaryGoal = 'Cautious Orbit / Flank';
      badge = `FUZZY: Flank (${(wFlank * 100).toFixed(0)}%)`;
    } else if (wAggressiveChase > 0.4) {
      primaryGoal = 'Predictive Intercept';
      badge = `FUZZY: Intercept (${(wAggressiveChase * 100).toFixed(0)}%)`;
    } else if (wRelentless > 0.5) {
      primaryGoal = 'Relentless Charge';
      badge = `FUZZY: Charge`;
    }

    const activatedRules = [
      { rule: 'IF Health is Low', weight: Number(wRetreat.toFixed(2)), action: 'Retreat to Heal Station' },
      { rule: 'IF Health Med & Dist Near', weight: Number(wFlank.toFixed(2)), action: 'Orbit / Flank Player' },
      { rule: 'IF Health Med & Dist Far', weight: Number(wBalancedChase.toFixed(2)), action: 'Balanced Pursuit' },
      { rule: 'IF Health High & Dist Far', weight: Number(wAggressiveChase.toFixed(2)), action: 'Predictive Intercept' },
      { rule: 'IF Health High & Dist Near', weight: Number(wRelentless.toFixed(2)), action: 'Direct Ramming' },
    ];

    const steerAngleDeg = (Math2D.vecToHeading(blendedDir) * 180) / Math.PI;

    const debug: FuzzyMembershipState = {
      distanceNear: Number(distNear.toFixed(2)),
      distanceMed: Number(distMed.toFixed(2)),
      distanceFar: Number(distFar.toFixed(2)),
      healthLow: Number(healthLow.toFixed(2)),
      healthMed: Number(healthMed.toFixed(2)),
      healthHigh: Number(healthHigh.toFixed(2)),
      obstacleDanger: Number(obstacleDanger.toFixed(2)),
      activatedRules,
      defuzzifiedGoal: primaryGoal,
      speedMultiplier: Number(speedMultiplier.toFixed(2)),
      steerAngleDeg: Math.round(steerAngleDeg),
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
