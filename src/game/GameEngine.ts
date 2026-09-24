/**
 * Core Game Engine: simulation loop, entity physics, raycast sensor updates,
 * collision resolution, health systems, and AI execution.
 */

import {
  Vector2,
  NPC,
  Player,
  Crate,
  HealingStation,
  HealthOrb,
  PulseWaveEffect,
  DamageNumber,
  ParticleEffect,
  AIType,
  RaySensor,
  CratePreset,
  ExperimentScenarioConfig,
  TrialResult,
} from '../types';
import { Math2D } from '../utils/math';
import { FuzzySteeringEngine } from '../ai/fuzzy';
import { BTNode, createComplexMovementBehaviorTree, BTExecutionContext } from '../ai/behaviorTree';
import { SimpleDecisionEngine } from '../ai/simpleLogic';
import { GOAPSteeringEngine } from '../ai/goap';
import { UtilityAIEngine } from '../ai/utility';
import { getMapLayout } from './mapLayouts';
import { TrialMetricsTracker } from './TrialMetricsCollector';
import { PerformanceProfiler } from './PerformanceProfiler';

export class GameEngine {
  public width: number;
  public height: number;
  public player: Player;
  public npcs: NPC[] = [];
  public crates: Crate[] = [];
  public healStations: HealingStation[] = [];
  public healthOrbs: HealthOrb[] = [];
  public pulseWaves: PulseWaveEffect[] = [];
  public damageNumbers: DamageNumber[] = [];
  public particles: ParticleEffect[] = [];

  // Real-time AI Performance Profiler
  public profiler: PerformanceProfiler = new PerformanceProfiler();

  // Behavior Tree instances mapped by NPC ID
  private btInstances: Map<string, BTNode> = new Map();

  // Selected NPC for in-depth Inspector panel
  public selectedNpcId: string | null = null;

  // Game stats
  public survivalTime = 0;
  public orbsCollected = 0;
  public isGameOver = false;
  public isPaused = false;
  public timeScale = 1.0;
  public currentPreset: CratePreset = 'tactical';

  // Controlled Experiment State
  public isExperimentMode = false;
  public activeTrialTracker: TrialMetricsTracker | null = null;
  public trialTimeLimit = 35;
  public onTrialComplete?: (result: TrialResult) => void;
  public activeScenarioConfig: ExperimentScenarioConfig | null = null;

  // Input states
  private keysDown: Set<string> = new Set();
  private mouseTarget: Vector2 | null = null;
  private orbSpawnTimer = 3.0;

  constructor(width = 1000, height = 700) {
    this.width = width;
    this.height = height;

    this.player = {
      id: 'player',
      x: width * 0.5,
      y: height * 0.5,
      vx: 0,
      vy: 0,
      rotation: 0,
      size: 26,
      health: 100,
      maxHealth: 100,
      maxSpeed: 230,
      pulseCooldown: 0,
      maxPulseCooldown: 3.5,
      damageFlash: 0,
    };

    this.loadPreset('tactical');
    this.spawnInitialEnemies();
    this.spawnHealthOrb();
    this.spawnHealthOrb();
  }

  public loadPreset(preset: CratePreset) {
    this.currentPreset = preset;
    const layout = getMapLayout(preset, this.width, this.height);
    this.crates = layout.crates;
    this.healStations = layout.healStations;
  }

  public resize(newWidth: number, newHeight: number) {
    if (newWidth < 400 || newHeight < 300) return;
    this.width = newWidth;
    this.height = newHeight;
    this.loadPreset(this.currentPreset);

    // Keep entities in bounds
    this.player.x = Math2D.clamp(this.player.x, 30, this.width - 30);
    this.player.y = Math2D.clamp(this.player.y, 30, this.height - 30);
    for (const npc of this.npcs) {
      npc.x = Math2D.clamp(npc.x, 30, this.width - 30);
      npc.y = Math2D.clamp(npc.y, 30, this.height - 30);
    }
  }

  public resetGame() {
    this.survivalTime = 0;
    this.orbsCollected = 0;
    this.isGameOver = false;
    this.player.health = 100;
    this.player.x = this.width * 0.5;
    this.player.y = this.height * 0.5;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.pulseCooldown = 0;
    this.pulseWaves = [];
    this.damageNumbers = [];
    this.particles = [];
    this.healthOrbs = [];
    this.spawnInitialEnemies();
    this.spawnHealthOrb();
    this.spawnHealthOrb();
  }

  public spawnInitialEnemies() {
    this.npcs = [];
    this.btInstances.clear();
    GOAPSteeringEngine.clearMemory();
    UtilityAIEngine.clearMemory();

    // Spawn 1 Fuzzy, 1 Behavior Tree, 1 Simple Logic, 1 GOAP, and 1 Utility AI
    this.spawnNPC('fuzzy', { x: this.width * 0.15, y: this.height * 0.85 });
    this.spawnNPC('behavior_tree', { x: this.width * 0.85, y: this.height * 0.15 });
    this.spawnNPC('simple', { x: this.width * 0.85, y: this.height * 0.85 });
    this.spawnNPC('goap', { x: this.width * 0.15, y: this.height * 0.15 });
    this.spawnNPC('utility', { x: this.width * 0.5, y: this.height * 0.88 });

    // Auto-select the first NPC for inspection
    if (this.npcs.length > 0) {
      this.selectedNpcId = this.npcs[0].id;
    }
  }

  public spawnNPC(aiType: AIType, customPos?: Vector2): NPC {
    const id = `npc_${aiType}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let color = '#06b6d4'; // Fuzzy cyan
    let accentColor = '#22d3ee';
    let name = 'Fuzzy Logic AI';

    if (aiType === 'behavior_tree') {
      color = '#8b5cf6'; // BT violet
      accentColor = '#a78bfa';
      name = 'Behavior Tree AI';
      this.btInstances.set(id, createComplexMovementBehaviorTree());
    } else if (aiType === 'simple') {
      color = '#f59e0b'; // Simple amber
      accentColor = '#fbbf24';
      name = 'Simple Decision AI';
    } else if (aiType === 'goap') {
      color = '#3b82f6'; // GOAP Blue
      accentColor = '#60a5fa';
      name = 'GOAP Planner AI';
    } else if (aiType === 'utility') {
      color = '#f43f5e'; // Utility Rose
      accentColor = '#fb7185';
      name = 'Utility AI';
    }

    // Determine spawn position safe from player and other NPCs
    let pos = customPos;
    if (!pos) {
      let attempts = 0;
      do {
        pos = {
          x: 50 + Math.random() * (this.width - 100),
          y: 50 + Math.random() * (this.height - 100),
        };
        attempts++;
      } while (
        attempts < 25 &&
        (Math2D.dist(pos, { x: this.player.x, y: this.player.y }) < 180 ||
          this.crates.some((c) => Math2D.pointInAABB(pos!, c, 30)) ||
          this.npcs.some((n) => Math2D.dist(pos!, n) < 45))
      );
    }

    // Setup 5-feeler ray sensors
    const sensors: RaySensor[] = [
      { angleOffset: 0, length: 115, hitDistance: 115, isBlocked: false },
      { angleOffset: -0.42, length: 95, hitDistance: 95, isBlocked: false },
      { angleOffset: 0.42, length: 95, hitDistance: 95, isBlocked: false },
      { angleOffset: -0.85, length: 65, hitDistance: 65, isBlocked: false },
      { angleOffset: 0.85, length: 65, hitDistance: 65, isBlocked: false },
    ];

    const maxSpeed =
      aiType === 'behavior_tree'
        ? 185
        : aiType === 'fuzzy'
        ? 190
        : aiType === 'goap'
        ? 185
        : aiType === 'utility'
        ? 188
        : 175;

    const npc: NPC = {
      id,
      aiType,
      color,
      accentColor,
      name,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      rotation: Math.random() * Math.PI * 2,
      size: 24,
      health: 100,
      maxHealth: 100,
      maxSpeed,
      maxForce: 420,
      isHealing: false,
      healingTimer: 0,
      sensors,
      lastDamageTime: 0,
      aggressionStamina: 4.0, // 4 seconds of sprint/aggressive chase
      maxAggressionStamina: 4.0,
      isExhausted: false,
      debugData: {
        desiredVelocity: { x: 0, y: 0 },
        steeringForce: { x: 0, y: 0 },
        stateBadge: 'Initializing...',
      },
    };

    this.npcs.push(npc);
    if (!this.selectedNpcId) {
      this.selectedNpcId = id;
    }
    return npc;
  }

  public removeNPC(id: string) {
    this.npcs = this.npcs.filter((n) => n.id !== id);
    this.btInstances.delete(id);
    GOAPSteeringEngine.clearMemory(id);
    UtilityAIEngine.clearMemory(id);
    if (this.selectedNpcId === id) {
      this.selectedNpcId = this.npcs[0]?.id || null;
    }
  }

  public removeLastNPCOfType(aiType: AIType) {
    const idx = [...this.npcs].reverse().findIndex((n) => n.aiType === aiType);
    if (idx !== -1) {
      const realIndex = this.npcs.length - 1 - idx;
      const target = this.npcs[realIndex];
      this.removeNPC(target.id);
    }
  }

  public spawnHealthOrb() {
    if (this.healthOrbs.length >= 5) return;
    let attempts = 0;
    let pos: Vector2 = { x: 0, y: 0 };
    let valid = false;

    while (attempts < 20 && !valid) {
      pos = {
        x: 60 + Math.random() * (this.width - 120),
        y: 60 + Math.random() * (this.height - 120),
      };
      valid = !this.crates.some((c) => Math2D.pointInAABB(pos, c, 20));
      attempts++;
    }

    if (valid) {
      this.healthOrbs.push({
        id: `orb_${Date.now()}_${Math.random()}`,
        x: pos.x,
        y: pos.y,
        radius: 12,
        value: 30,
        spawnTime: this.survivalTime,
      });
    }
  }

  // Damage selected or all NPCs to demonstrate low-health fleeing behavior
  public damageNPC(id: string, amount = 40) {
    const npc = this.npcs.find((n) => n.id === id);
    if (!npc) return;

    npc.health = Math.max(1, npc.health - amount);
    npc.lastDamageTime = this.survivalTime;

    this.addDamageNumber(npc.x, npc.y - 15, `-${amount}`, '#ef4444');
    this.createImpactParticles(npc.x, npc.y, npc.color, 12);
  }

  public damageAllEnemies(amount = 45) {
    for (const npc of this.npcs) {
      npc.health = Math.max(1, npc.health - amount);
      npc.lastDamageTime = this.survivalTime;
      this.addDamageNumber(npc.x, npc.y - 15, `-${amount}`, '#ef4444');
      this.createImpactParticles(npc.x, npc.y, npc.color, 8);
    }
  }

  // Player Shockwave Pulse Ability
  public triggerPlayerPulse(): boolean {
    if (this.player.pulseCooldown > 0 || this.isGameOver) return false;

    this.player.pulseCooldown = this.player.maxPulseCooldown;
    const px = this.player.x;
    const py = this.player.y;
    const pulseRadius = 220;

    this.pulseWaves.push({
      x: px,
      y: py,
      radius: 10,
      maxRadius: pulseRadius,
      alpha: 1.0,
    });

    // Knockback & damage all nearby NPCs
    for (const npc of this.npcs) {
      const dist = Math2D.dist({ x: px, y: py }, { x: npc.x, y: npc.y });
      if (dist < pulseRadius) {
        const damage = Math.round(35 * (1 - dist / (pulseRadius * 1.2)));
        npc.health = Math.max(0, npc.health - damage);
        npc.lastDamageTime = this.survivalTime;

        if (this.activeTrialTracker && npc.id === this.npcs[0]?.id) {
          this.activeTrialTracker.recordDamageReceived(damage);
        }

        // Radial knockback force
        const knockDir = Math2D.normalize({ x: npc.x - px, y: npc.y - py });
        npc.vx += knockDir.x * 280;
        npc.vy += knockDir.y * 280;

        this.addDamageNumber(npc.x, npc.y - 18, `-${damage} EMP`, '#38bdf8');
        this.createImpactParticles(npc.x, npc.y, '#38bdf8', 10);
      }
    }

    return true;
  }

  public setKeyDown(key: string) {
    this.keysDown.add(key.toLowerCase());
  }

  public setKeyUp(key: string) {
    this.keysDown.delete(key.toLowerCase());
  }

  public setMouseTarget(pos: Vector2 | null) {
    this.mouseTarget = pos;
  }

  public update(rawDt: number) {
    if (this.isPaused || this.isGameOver) return;
    this.profiler.startFrame();

    // Cap delta time to prevent tunneling on frame drops
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    this.survivalTime += dt;

    // Update player pulse cooldown
    if (this.player.pulseCooldown > 0) {
      this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - dt);
    }
    if (this.player.damageFlash > 0) {
      this.player.damageFlash = Math.max(0, this.player.damageFlash - dt);
    }

    // Health orb spawner (interactive sandbox only)
    if (!this.isExperimentMode) {
      this.orbSpawnTimer -= dt;
      if (this.orbSpawnTimer <= 0) {
        this.spawnHealthOrb();
        this.orbSpawnTimer = 4.5;
      }
    }

    // 1. Update Player Movement
    this.updatePlayer(dt);

    // 2. Update NPCs (Sensors -> AI -> Physics -> Crates -> Shrines)
    this.updateNPCs(dt);

    // 3. Update Health Orbs & Pickup
    if (!this.isExperimentMode) {
      this.updateHealthOrbs();
    }

    // 4. Update Visual Effects (Pulses, Damage Numbers, Particles)
    this.updateVisualEffects(dt);

    // 5. Experiment Trial Step & Termination Evaluation
    if (this.isExperimentMode && this.activeTrialTracker && this.npcs.length > 0) {
      const testNpc = this.npcs[0];
      const isRetreat =
        testNpc.isHealing ||
        testNpc.isExhausted ||
        testNpc.debugData.stateBadge.includes('Tired') ||
        testNpc.debugData.stateBadge.includes('Retreat') ||
        testNpc.debugData.stateBadge.includes('Flee') ||
        testNpc.debugData.stateBadge.includes('Stand-off') ||
        testNpc.debugData.fuzzy?.defuzzifiedGoal === 'RETREAT & HEAL' ||
        (testNpc.debugData.behaviorTree?.currentAction.toLowerCase().includes('heal') ?? false) ||
        (testNpc.debugData.behaviorTree?.currentAction.toLowerCase().includes('breath') ?? false) ||
        (testNpc.debugData.goap?.currentActionName.toLowerCase().includes('heal') ?? false) ||
        (testNpc.debugData.utility?.selectedAction.toLowerCase().includes('heal') ?? false) ||
        testNpc.debugData.simple?.currentState === 'FLEE_TO_HEAL' ||
        testNpc.debugData.simple?.currentState === 'EXHAUSTED_STANDOFF';

      const pDist = Math2D.dist({ x: testNpc.x, y: testNpc.y }, { x: this.player.x, y: this.player.y });
      const minCombatDist = (testNpc.size + this.player.size) / 2;
      const isMeleeContact = pDist <= minCombatDist + 5;

      this.activeTrialTracker.onStep(
        dt,
        { x: testNpc.x, y: testNpc.y },
        testNpc.health,
        this.player.health,
        isRetreat,
        isMeleeContact
      );

      const isTimeout = this.survivalTime >= this.trialTimeLimit;
      const isNpcDead = testNpc.health <= 0;
      const isPlayerDead = this.player.health <= 0;

      if (isTimeout || isNpcDead || isPlayerDead) {
        const reason = isPlayerDead ? 'player_death' : isNpcDead ? 'npc_death' : 'timeout';
        const result = this.activeTrialTracker.finalize(reason);
        this.activeTrialTracker = null;
        if (this.onTrialComplete) {
          this.onTrialComplete(result);
        }
      }
    }
  }

  private updatePlayer(dt: number) {
    if (this.isExperimentMode) {
      this.updateAutomatedPlayer(dt);
      return;
    }

    let moveX = 0;
    let moveY = 0;

    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) moveY -= 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) moveY += 1;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) moveX -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) moveX += 1;

    // Spacebar triggers pulse
    if (this.keysDown.has(' ') || this.keysDown.has('space')) {
      this.triggerPlayerPulse();
    }

    // Mouse drag steering fallback
    if (moveX === 0 && moveY === 0 && this.mouseTarget) {
      const toMouse = Math2D.sub(this.mouseTarget, { x: this.player.x, y: this.player.y });
      const mouseDist = Math2D.length(toMouse);
      if (mouseDist > 20) {
        const norm = Math2D.scale(toMouse, 1 / mouseDist);
        moveX = norm.x;
        moveY = norm.y;
      }
    }

    const accel = 950;
    const friction = 7.0;

    if (moveX !== 0 || moveY !== 0) {
      const inputDir = Math2D.normalize({ x: moveX, y: moveY });
      this.player.vx += inputDir.x * accel * dt;
      this.player.vy += inputDir.y * accel * dt;
    }

    // Apply friction
    this.player.vx -= this.player.vx * friction * dt;
    this.player.vy -= this.player.vy * friction * dt;

    // Clamp speed
    const currentSpeed = Math2D.length({ x: this.player.vx, y: this.player.vy });
    if (currentSpeed > this.player.maxSpeed) {
      const scaled = Math2D.scale({ x: this.player.vx, y: this.player.vy }, this.player.maxSpeed / currentSpeed);
      this.player.vx = scaled.x;
      this.player.vy = scaled.y;
    }

    // Update position
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    if (currentSpeed > 10) {
      this.player.rotation = Math.atan2(this.player.vy, this.player.vx);
    }

    // Collision with crates
    const pHalf = this.player.size / 2;
    for (const crate of this.crates) {
      const resolved = Math2D.resolveBoxCollision({ x: this.player.x, y: this.player.y }, pHalf, crate);
      this.player.x = resolved.x;
      this.player.y = resolved.y;
    }

    // Clamp to map boundaries
    this.player.x = Math2D.clamp(this.player.x, pHalf, this.width - pHalf);
    this.player.y = Math2D.clamp(this.player.y, pHalf, this.height - pHalf);
  }

  private updateNPCs(dt: number) {
    const playerPos = { x: this.player.x, y: this.player.y };

    for (const npc of this.npcs) {
      const npcPos = { x: npc.x, y: npc.y };

      // Find nearest heal station
      let nearestHealStation: HealingStation | null = null;
      let minStationDist = Infinity;
      for (const hs of this.healStations) {
        const hsCenter = { x: hs.x + hs.width / 2, y: hs.y + hs.height / 2 };
        const d = Math2D.dist(npcPos, hsCenter);
        if (d < minStationDist) {
          minStationDist = d;
          nearestHealStation = hs;
        }
      }

      // 1. Update Ray Sensors (Cast rays against crates & boundary walls)
      this.updateSensors(npc);

      // 2. Execute Specific AI Algorithm
      let desiredVel: Vector2 = { x: 0, y: 0 };
      let steerForce: Vector2 = { x: 0, y: 0 };
      let targetPt: Vector2 = playerPos;
      let badge = '';

      const aiStartTime = performance.now();

      if (npc.aiType === 'fuzzy') {
        const result = FuzzySteeringEngine.evaluate(
          npc,
          this.player,
          this.crates,
          this.healStations,
          nearestHealStation
        );
        desiredVel = result.desiredVelocity;
        steerForce = result.steeringForce;
        targetPt = result.targetPoint;
        badge = result.badge;
        npc.debugData.fuzzy = result.debug;
      } else if (npc.aiType === 'behavior_tree') {
        const btTree = this.btInstances.get(npc.id);
        if (btTree) {
          const activePath: string[] = [];
          const ctx: BTExecutionContext = {
            npc,
            player: this.player,
            crates: this.crates,
            healStations: this.healStations,
            nearestHealStation,
            desiredVelocity: { x: 0, y: 0 },
            steeringForce: { x: 0, y: 0 },
            targetPoint: playerPos,
            currentActionName: '',
            badge: 'BT: Active',
          };

          btTree.tick(ctx, activePath);

          desiredVel = ctx.desiredVelocity;
          steerForce = ctx.steeringForce;
          targetPt = ctx.targetPoint;
          badge = ctx.badge;

          npc.debugData.behaviorTree = {
            rootSnapshot: btTree.getSnapshot(),
            activePath,
            currentAction: ctx.currentActionName,
          };
        }
      } else if (npc.aiType === 'goap') {
        // Goal-Oriented Action Planning (GOAP)
        const result = GOAPSteeringEngine.evaluate(
          npc,
          this.player,
          this.crates,
          this.healStations,
          nearestHealStation
        );
        desiredVel = result.desiredVelocity;
        steerForce = result.steeringForce;
        targetPt = result.targetPoint;
        badge = result.badge;
        npc.debugData.goap = result.debug;
      } else if (npc.aiType === 'utility') {
        // Utility AI System
        const result = UtilityAIEngine.evaluate(
          npc,
          this.player,
          this.crates,
          this.healStations,
          nearestHealStation
        );
        desiredVel = result.desiredVelocity;
        steerForce = result.steeringForce;
        targetPt = result.targetPoint;
        badge = result.badge;
        npc.debugData.utility = result.debug;
      } else {
        // Simple Decision Logic
        const result = SimpleDecisionEngine.evaluate(
          npc,
          this.player,
          this.crates,
          this.healStations,
          nearestHealStation
        );
        desiredVel = result.desiredVelocity;
        steerForce = result.steeringForce;
        targetPt = result.targetPoint;
        badge = result.badge;
        npc.debugData.simple = result.debug;
      }

      const aiElapsed = performance.now() - aiStartTime;
      this.profiler.recordAIEvaluation(npc.aiType, aiElapsed);

      // Flocking separation: proactively repels NPCs from each other to prevent clustering/conga lines
      const separationRadius = 52;
      for (const other of this.npcs) {
        if (other.id === npc.id) continue;
        let dx = npc.x - other.x;
        let dy = npc.y - other.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 0.01) {
          dx = (Math.random() - 0.5) * 2;
          dy = (Math.random() - 0.5) * 2;
          distSq = dx * dx + dy * dy;
        }
        if (distSq < separationRadius * separationRadius) {
          const dist = Math.sqrt(distSq);
          const falloff = 1 - dist / separationRadius;
          const forceMag = falloff * falloff * 320;
          steerForce.x += (dx / dist) * forceMag;
          steerForce.y += (dy / dist) * forceMag;
        }
      }

      // Aggression Stamina System:
      // When actively pursuing player or sprinting in high-aggression modes, stamina depletes.
      // After ~4s of continuous sprinting/close chase, stamina empties and enters exhaustion (recharging slowly).
      const distToPlayer = Math2D.dist({ x: npc.x, y: npc.y }, playerPos);
      const isAggressiveAction =
        badge.includes('Pounce') ||
        badge.includes('Charge') ||
        badge.includes('Intercept') ||
        (badge.includes('Chase') && distToPlayer < 260) ||
        (badge.includes('Flank') && distToPlayer < 200);

      if (isAggressiveAction && !npc.isExhausted) {
        // Drain stamina over ~4 seconds
        npc.aggressionStamina = Math.max(0, (npc.aggressionStamina ?? 4.0) - dt);
        if (npc.aggressionStamina <= 0) {
          npc.isExhausted = true;
        }
      } else {
        // Regenerate stamina when not sprinting/chasing aggressively or when exhausted
        const regenRate = npc.isExhausted ? 0.8 : 1.2; // ~5s to fully recharge from empty
        npc.aggressionStamina = Math.min(
          npc.maxAggressionStamina ?? 4.0,
          (npc.aggressionStamina ?? 0) + dt * regenRate
        );
        // Recover from exhaustion once stamina reaches at least 50%
        if (npc.isExhausted && npc.aggressionStamina >= (npc.maxAggressionStamina ?? 4.0) * 0.5) {
          npc.isExhausted = false;
        }
      }

      // If exhausted and badge doesn't already indicate tired, prepend the tired badge
      if (npc.isExhausted && !badge.includes('Tired')) {
        badge = `⚡ Tired (${Math.ceil(npc.aggressionStamina)}s)`;
      }

      npc.debugData.desiredVelocity = desiredVel;
      npc.debugData.steeringForce = steerForce;
      npc.debugData.targetPoint = targetPt;
      npc.debugData.stateBadge = badge;

      // 3. Physics Integration: Velocity += Steering * dt
      npc.vx += steerForce.x * dt;
      npc.vy += steerForce.y * dt;

      // Dynamic Speed Cap based on Exhaustion:
      // Normal top speed when fresh; reduced to 55% speed when exhausted so player easily escapes
      const currentMaxSpeed = npc.isExhausted ? npc.maxSpeed * 0.55 : npc.maxSpeed * 1.12;
      const speed = Math2D.length({ x: npc.vx, y: npc.vy });
      if (speed > currentMaxSpeed) {
        const capped = Math2D.scale({ x: npc.vx, y: npc.vy }, currentMaxSpeed / speed);
        npc.vx = capped.x;
        npc.vy = capped.y;
      }

      // Light damping
      npc.vx *= 0.985;
      npc.vy *= 0.985;

      // Update position
      npc.x += npc.vx * dt;
      npc.y += npc.vy * dt;

      // Update rotation
      if (speed > 8) {
        const targetRot = Math.atan2(npc.vy, npc.vx);
        // Smooth rotation interpolation
        let angleDiff = targetRot - npc.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        npc.rotation += angleDiff * Math.min(1, 10 * dt);
      }

      // 4. Box vs Crate Collisions
      const halfSize = npc.size / 2;
      for (const crate of this.crates) {
        const resolved = Math2D.resolveBoxCollision({ x: npc.x, y: npc.y }, halfSize, crate);
        npc.x = resolved.x;
        npc.y = resolved.y;
      }

      // Keep NPC inside map bounds
      npc.x = Math2D.clamp(npc.x, halfSize, this.width - halfSize);
      npc.y = Math2D.clamp(npc.y, halfSize, this.height - halfSize);

      // 5. Healing Station Checks
      let isInsideShrine = false;
      for (const hs of this.healStations) {
        if (Math2D.pointInAABB({ x: npc.x, y: npc.y }, hs, halfSize)) {
          isInsideShrine = true;
          if (npc.health < npc.maxHealth) {
            const healGain = hs.healRatePerSec * dt;
            npc.health = Math.min(npc.maxHealth, npc.health + healGain);
            npc.isHealing = true;

            // Spawn green healing motes occasionally
            if (Math.random() < 0.35) {
              this.particles.push({
                x: npc.x + (Math.random() - 0.5) * npc.size,
                y: npc.y + (Math.random() - 0.5) * npc.size,
                vx: (Math.random() - 0.5) * 15,
                vy: -30 - Math.random() * 20,
                life: 0.7,
                maxLife: 0.7,
                size: 3 + Math.random() * 2,
                color: '#34d399',
              });
            }
          }
          break;
        }
      }

      if (isInsideShrine && npc.health >= npc.maxHealth * 0.95) {
        npc.isHealing = false;
      } else if (!isInsideShrine && npc.health >= npc.maxHealth * 0.75) {
        npc.isHealing = false;
      }

      // 6. NPC vs Player Combat Collision
      const pDist = Math2D.dist({ x: npc.x, y: npc.y }, playerPos);
      const minCombatDist = (npc.size + this.player.size) / 2;
      if (pDist < minCombatDist) {
        // Player takes damage when touched by enemy
        const damagePerSec = 22;
        const dmg = damagePerSec * dt;
        this.player.health = Math.max(0, this.player.health - dmg);
        this.player.damageFlash = 0.2;

        if (this.activeTrialTracker && npc.id === this.npcs[0]?.id) {
          this.activeTrialTracker.recordDamageDealt(dmg);
        }

        // Push away slightly
        const pushDir = Math2D.normalize({ x: this.player.x - npc.x, y: this.player.y - npc.y });
        this.player.x += pushDir.x * 25 * dt;
        this.player.y += pushDir.y * 25 * dt;

        if (this.player.health <= 0 && !this.isGameOver) {
          this.isGameOver = true;
        }
      }
    }

    // 7. Multi-Agent Rigid Body Anti-Stacking & Collision Resolution (2 relaxation passes)
    for (let pass = 0; pass < 2; pass++) {
      // A. NPC vs NPC Solid Non-Penetration Resolution
      for (let i = 0; i < this.npcs.length; i++) {
        for (let j = i + 1; j < this.npcs.length; j++) {
          const a = this.npcs[i];
          const b = this.npcs[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distSq = dx * dx + dy * dy;
          // Required distance between centers to prevent any overlap
          const minDist = (a.size + b.size) * 0.58; // ~28px for 24px boxes

          if (distSq < 0.01) {
            // Perfectly stacked degenerate case: nudge apart randomly
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distSq = 1;
          }

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            // Push each NPC back half the overlap distance
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            // Soft separation damping to prevent sticky clustering without slingshotting forward
            const relVx = b.vx - a.vx;
            const relVy = b.vy - a.vy;
            const normalVel = relVx * nx + relVy * ny;
            if (normalVel < 0) {
              const restitution = 0.15; // Low restitution prevents bouncy pinballing
              const impulse = -(1 + restitution) * normalVel * 0.4;
              a.vx -= nx * impulse;
              a.vy -= ny * impulse;
              b.vx += nx * impulse;
              b.vy += ny * impulse;
            }
          }
        }
      }

      // B. NPC vs Player Solid Non-Penetration Resolution
      for (const npc of this.npcs) {
        let dx = this.player.x - npc.x;
        let dy = this.player.y - npc.y;
        let distSq = dx * dx + dy * dy;
        const minCombatDist = (npc.size + this.player.size) * 0.52;

        if (distSq < 0.01) {
          dx = 1;
          dy = 0;
          distSq = 1;
        }

        if (distSq < minCombatDist * minCombatDist) {
          const dist = Math.sqrt(distSq);
          const overlap = minCombatDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Push NPC back primarily, player slightly back
          npc.x -= nx * overlap * 0.7;
          npc.y -= ny * overlap * 0.7;
          this.player.x += nx * overlap * 0.3;
          this.player.y += ny * overlap * 0.3;

          const relVx = this.player.vx - npc.vx;
          const relVy = this.player.vy - npc.vy;
          const normalVel = relVx * nx + relVy * ny;
          if (normalVel < 0) {
            npc.vx -= nx * normalVel * 0.5;
            npc.vy -= ny * normalVel * 0.5;
          }
        }
      }

      // C. Re-constrain NPCs against crates and screen boundaries after separation pushes
      for (const npc of this.npcs) {
        const halfSize = npc.size / 2;
        for (const crate of this.crates) {
          const resolved = Math2D.resolveBoxCollision({ x: npc.x, y: npc.y }, halfSize, crate);
          npc.x = resolved.x;
          npc.y = resolved.y;
        }
        npc.x = Math2D.clamp(npc.x, halfSize, this.width - halfSize);
        npc.y = Math2D.clamp(npc.y, halfSize, this.height - halfSize);
      }
    }

    // Maintain live background calibration for algorithms not currently active in arena
    this.profiler.performBackgroundCalibration(this);
  }

  private updateSensors(npc: NPC) {
    const origin = { x: npc.x, y: npc.y };

    for (const sensor of npc.sensors) {
      const heading = npc.rotation + sensor.angleOffset;
      const dir = Math2D.headingToVec(heading);

      let closestHitDist = sensor.length;
      let hitPoint: Vector2 | undefined;
      let hitNormal: Vector2 | undefined;
      let isBlocked = false;

      // 1. Raycast against crates
      for (const crate of this.crates) {
        const hit = Math2D.rayIntersectAABB(origin, dir, sensor.length, crate);
        if (hit.hit && hit.distance < closestHitDist) {
          closestHitDist = hit.distance;
          hitPoint = hit.point;
          hitNormal = hit.normal;
          isBlocked = true;
        }
      }

      // 2. Raycast against outer boundary walls
      // Left boundary (x = 0)
      if (dir.x < 0) {
        const t = -origin.x / dir.x;
        if (t >= 0 && t < closestHitDist) {
          closestHitDist = t;
          hitPoint = { x: 0, y: origin.y + dir.y * t };
          hitNormal = { x: 1, y: 0 };
          isBlocked = true;
        }
      }
      // Right boundary (x = width)
      if (dir.x > 0) {
        const t = (this.width - origin.x) / dir.x;
        if (t >= 0 && t < closestHitDist) {
          closestHitDist = t;
          hitPoint = { x: this.width, y: origin.y + dir.y * t };
          hitNormal = { x: -1, y: 0 };
          isBlocked = true;
        }
      }
      // Top boundary (y = 0)
      if (dir.y < 0) {
        const t = -origin.y / dir.y;
        if (t >= 0 && t < closestHitDist) {
          closestHitDist = t;
          hitPoint = { x: origin.x + dir.x * t, y: 0 };
          hitNormal = { x: 0, y: 1 };
          isBlocked = true;
        }
      }
      // Bottom boundary (y = height)
      if (dir.y > 0) {
        const t = (this.height - origin.y) / dir.y;
        if (t >= 0 && t < closestHitDist) {
          closestHitDist = t;
          hitPoint = { x: origin.x + dir.x * t, y: this.height };
          hitNormal = { x: 0, y: -1 };
          isBlocked = true;
        }
      }

      sensor.hitDistance = closestHitDist;
      sensor.hitPoint = hitPoint;
      sensor.normal = hitNormal;
      sensor.isBlocked = isBlocked;
    }
  }

  private updateHealthOrbs() {
    const playerPos = { x: this.player.x, y: this.player.y };
    const pRadius = this.player.size / 2;

    for (let i = this.healthOrbs.length - 1; i >= 0; i--) {
      const orb = this.healthOrbs[i];
      const dist = Math2D.dist(playerPos, { x: orb.x, y: orb.y });

      // Player collects orb
      if (dist < pRadius + orb.radius) {
        const healAmt = Math.min(this.player.maxHealth - this.player.health, orb.value);
        this.player.health = Math.min(this.player.maxHealth, this.player.health + orb.value);
        this.orbsCollected++;

        this.addDamageNumber(orb.x, orb.y - 12, `+${orb.value} HP`, '#10b981');
        this.createImpactParticles(orb.x, orb.y, '#10b981', 14);

        // Remove orb
        this.healthOrbs.splice(i, 1);
      }
    }
  }

  private updateVisualEffects(dt: number) {
    // Pulse waves
    for (let i = this.pulseWaves.length - 1; i >= 0; i--) {
      const wave = this.pulseWaves[i];
      wave.radius += 550 * dt;
      wave.alpha = Math.max(0, 1 - wave.radius / wave.maxRadius);
      if (wave.radius >= wave.maxRadius || wave.alpha <= 0.01) {
        this.pulseWaves.splice(i, 1);
      }
    }

    // Damage numbers
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.y += dn.vy * dt;
      dn.alpha -= 1.3 * dt;
      if (dn.alpha <= 0) {
        this.damageNumbers.splice(i, 1);
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  public addDamageNumber(x: number, y: number, text: string, color: string) {
    this.damageNumbers.push({
      id: `dn_${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      color,
      alpha: 1.0,
      vy: -40,
    });
  }

  public createImpactParticles(x: number, y: number, color: string, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  /**
   * Deterministic automated benchmark player for controlled evaluation trials.
   * Ensures that all 5 AI architectures face the exact identical opponent behavior,
   * kiting dynamics, and pulse shockwave defenses.
   */
  private updateAutomatedPlayer(dt: number) {
    if (this.npcs.length === 0) return;
    const targetNpc = this.npcs[0];
    const distToNpc = Math2D.dist({ x: this.player.x, y: this.player.y }, { x: targetNpc.x, y: targetNpc.y });

    // 1. Tactical pulse shockwave defense:
    // If NPC gets within 135px and pulse cooldown is ready, blast them
    if (distToNpc < 135 && this.player.pulseCooldown <= 0) {
      this.triggerPlayerPulse();
    }

    // 2. Deterministic steering movement:
    // The player maintains a tactical spacing (approx 180px away), maneuvering around obstacles
    let moveDir: Vector2 = { x: 0, y: 0 };

    if (distToNpc < 190) {
      // Kite away from NPC
      const awayDir = Math2D.normalize({ x: this.player.x - targetNpc.x, y: this.player.y - targetNpc.y });
      // Add slight perpendicular orbital tangent to avoid getting cornered against walls
      const tangent = { x: -awayDir.y, y: awayDir.x };
      moveDir = Math2D.normalize({
        x: awayDir.x * 0.75 + tangent.x * 0.45,
        y: awayDir.y * 0.75 + tangent.y * 0.45,
      });
    } else if (distToNpc > 340) {
      // Advance cautiously back toward engagement zone
      const towardDir = Math2D.normalize({ x: targetNpc.x - this.player.x, y: targetNpc.y - this.player.y });
      moveDir = towardDir;
    } else {
      // Orbit / strafe at optimal combat range
      const toNpc = Math2D.normalize({ x: targetNpc.x - this.player.x, y: targetNpc.y - this.player.y });
      moveDir = { x: -toNpc.y, y: toNpc.x };
    }

    // Boundary repulsion to prevent the player bot from hugging perimeter walls
    const boundMargin = 70;
    if (this.player.x < boundMargin) moveDir.x += 1.5;
    if (this.player.x > this.width - boundMargin) moveDir.x -= 1.5;
    if (this.player.y < boundMargin) moveDir.y += 1.5;
    if (this.player.y > this.height - boundMargin) moveDir.y -= 1.5;

    // Obstacle avoidance for player bot against crates
    for (const crate of this.crates) {
      const cCenter = { x: crate.x + crate.width / 2, y: crate.y + crate.height / 2 };
      const dCrate = Math2D.dist({ x: this.player.x, y: this.player.y }, cCenter);
      const safeRadius = Math.max(crate.width, crate.height) * 0.75 + 30;
      if (dCrate < safeRadius) {
        const pushAway = Math2D.normalize({ x: this.player.x - cCenter.x, y: this.player.y - cCenter.y });
        moveDir = Math2D.add(moveDir, Math2D.scale(pushAway, 1.8));
      }
    }

    moveDir = Math2D.normalize(moveDir);

    const accel = 800;
    const friction = 6.5;

    this.player.vx += moveDir.x * accel * dt;
    this.player.vy += moveDir.y * accel * dt;

    this.player.vx -= this.player.vx * friction * dt;
    this.player.vy -= this.player.vy * friction * dt;

    const currentSpeed = Math2D.length({ x: this.player.vx, y: this.player.vy });
    const maxSpeed = this.player.maxSpeed * 0.88;
    if (currentSpeed > maxSpeed) {
      const scaled = Math2D.scale({ x: this.player.vx, y: this.player.vy }, maxSpeed / currentSpeed);
      this.player.vx = scaled.x;
      this.player.vy = scaled.y;
    }

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    if (currentSpeed > 10) {
      this.player.rotation = Math.atan2(this.player.vy, this.player.vx);
    }

    // Box vs crate collisions
    const pHalf = this.player.size / 2;
    for (const crate of this.crates) {
      const resolved = Math2D.resolveBoxCollision({ x: this.player.x, y: this.player.y }, pHalf, crate);
      this.player.x = resolved.x;
      this.player.y = resolved.y;
    }

    this.player.x = Math2D.clamp(this.player.x, pHalf, this.width - pHalf);
    this.player.y = Math2D.clamp(this.player.y, pHalf, this.height - pHalf);
  }

  /**
   * Sets up a controlled experimental trial with deterministic initial state.
   */
  public setupExperimentTrial(
    scenario: ExperimentScenarioConfig,
    aiType: AIType,
    experimentId: string,
    trialNumber: number,
    seed: number
  ) {
    this.isExperimentMode = true;
    this.activeScenarioConfig = scenario;
    this.trialTimeLimit = scenario.timeLimitSec;
    this.survivalTime = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.pulseWaves = [];
    this.damageNumbers = [];
    this.particles = [];
    this.healthOrbs = [];

    // Set scenario obstacles and shrines
    if (scenario.customCrates) {
      this.crates = scenario.customCrates.map((c) => ({ ...c }));
    } else if (scenario.cratePreset) {
      this.loadPreset(scenario.cratePreset);
    } else {
      this.crates = [];
    }
    this.healStations = scenario.healStations.map((h) => ({ ...h }));

    // Set player starting state
    this.player.x = scenario.playerStartPos.x;
    this.player.y = scenario.playerStartPos.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.health = scenario.playerInitialHealth;
    this.player.maxHealth = 100;
    this.player.pulseCooldown = 0;
    this.player.damageFlash = 0;

    // Clear NPCs and spawn only 1 test NPC
    this.npcs = [];
    this.btInstances.clear();
    GOAPSteeringEngine.clearMemory();
    UtilityAIEngine.clearMemory();

    const npc = this.spawnNPC(aiType, { ...scenario.npcStartPos });
    npc.health = scenario.npcInitialHealth;
    this.selectedNpcId = npc.id;

    // Initialize trial tracker
    this.activeTrialTracker = new TrialMetricsTracker(
      experimentId,
      trialNumber,
      aiType,
      npc.name,
      scenario.id,
      scenario.name,
      seed,
      scenario.timeLimitSec
    );
  }

  /**
   * Cleans up experiment mode and restores the interactive sandbox.
   */
  public endExperimentMode() {
    this.isExperimentMode = false;
    this.activeTrialTracker = null;
    this.activeScenarioConfig = null;
    this.resetGame();
  }

  /**
   * Fast-forward step for headless or accelerated simulation execution.
   */
  public stepFixed(dt = 1 / 60) {
    this.update(dt);
  }
}
