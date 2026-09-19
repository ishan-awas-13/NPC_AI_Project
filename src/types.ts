/**
 * Types and interfaces for the NPC Steering & Driving AI Demo.
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Crate extends AABB {
  id: string;
  label?: string;
  color?: string;
}

export interface HealthOrb {
  id: string;
  x: number;
  y: number;
  radius: number;
  value: number;
  spawnTime: number;
}

export interface HealingStation extends AABB {
  id: string;
  label: string;
  healRatePerSec: number;
  color: string;
}

export type AIType = 'fuzzy' | 'behavior_tree' | 'simple' | 'goap' | 'utility';

export interface RaySensor {
  angleOffset: number; // Angle relative to forward heading in radians
  length: number;
  hitDistance: number;
  hitPoint?: Vector2;
  isBlocked: boolean;
  normal?: Vector2;
}

export interface FuzzyMembershipState {
  distanceNear: number;
  distanceMed: number;
  distanceFar: number;
  healthLow: number;
  healthMed: number;
  healthHigh: number;
  obstacleDanger: number;
  activatedRules: {
    rule: string;
    weight: number;
    action: string;
  }[];
  defuzzifiedGoal: string;
  speedMultiplier: number;
  steerAngleDeg: number;
}

export type BTNodeStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING' | 'INACTIVE';

export interface BTNodeSnapshot {
  id: string;
  name: string;
  type: 'selector' | 'sequence' | 'action' | 'condition';
  status: BTNodeStatus;
  description: string;
  children?: BTNodeSnapshot[];
}

export interface SimpleLogicState {
  currentState: 'DIRECT_CHASE' | 'FLEE_TO_HEAL' | 'OBSTACLE_SLIDE' | 'EXHAUSTED_STANDOFF';
  reason: string;
  targetPoint: Vector2;
  obstacleDetected: boolean;
}

export interface GOAPActionInfo {
  name: string;
  cost: number;
  preconditions: Record<string, boolean>;
  effects: Record<string, boolean>;
  status: 'pending' | 'running' | 'completed';
}

export interface GOAPDebugState {
  currentGoal: string;
  goalPriority: number;
  worldState: Record<string, boolean>;
  plan: GOAPActionInfo[];
  currentActionIndex: number;
  currentActionName: string;
  totalPlanCost: number;
  replanCount: number;
}

export interface UtilityScoreInfo {
  actionName: string;
  score: number;
  curveType: string;
  weight: number;
  isActive: boolean;
  description: string;
}

export interface UtilityAIDebugState {
  scores: UtilityScoreInfo[];
  selectedAction: string;
  highestUtility: number;
  inertiaTimer: number;
}

export interface AIDebugData {
  fuzzy?: FuzzyMembershipState;
  behaviorTree?: {
    rootSnapshot: BTNodeSnapshot;
    activePath: string[];
    currentAction: string;
  };
  simple?: SimpleLogicState;
  goap?: GOAPDebugState;
  utility?: UtilityAIDebugState;
  desiredVelocity: Vector2;
  steeringForce: Vector2;
  targetPoint?: Vector2;
  stateBadge: string;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number; // radians
  size: number; // box width & height
  health: number;
  maxHealth: number;
}

export interface NPC extends Entity {
  aiType: AIType;
  color: string;
  accentColor: string;
  name: string;
  maxSpeed: number;
  maxForce: number;
  isHealing: boolean;
  healingTimer: number;
  sensors: RaySensor[];
  debugData: AIDebugData;
  lastDamageTime: number;
  aggressionStamina: number; // Current stamina in seconds (0 - maxStamina)
  maxAggressionStamina: number; // Max stamina duration in seconds (~4.0s)
  isExhausted: boolean; // True when stamina fully drained, recovers over cooldown
}

export interface Player extends Entity {
  maxSpeed: number;
  pulseCooldown: number;
  maxPulseCooldown: number;
  damageFlash: number;
}

export interface PulseWaveEffect {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export interface DamageNumber {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface DebugVisualSettings {
  showRaycasts: boolean;
  showSteeringVectors: boolean;
  showTargetLines: boolean;
  showAIStateBadges: boolean;
  showCrateBounds: boolean;
  showHealthBars: boolean;
  showDetectionRadius: boolean;
}

export type CratePreset = 'tactical' | 'pillars' | 'corridors' | 'scattered';
