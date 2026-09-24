/**
 * Metrics collection and statistical aggregation for experimental trials.
 * Tracks survival time, damage dealt, damage received, attacks, retreats,
 * distance travelled, and outcomes under strictly controlled scenarios.
 */

import { AIType, TrialResult, AggregatedAIMetrics, ExperimentScenarioId } from '../types';

export class TrialMetricsTracker {
  public experimentId: string;
  public trialNumber: number;
  public aiType: AIType;
  public aiLabel: string;
  public scenarioId: ExperimentScenarioId;
  public scenarioName: string;
  public seed: number;
  public timeLimitSec: number;

  public survivalTime = 0;
  public damageDealt = 0;
  public damageReceived = 0;
  public attacks = 0;
  public retreats = 0;
  public distanceTravelled = 0;

  public finalNpcHealth = 100;
  public finalPlayerHealth = 100;

  // Internal state tracking
  private lastNpcPos: { x: number; y: number } | null = null;
  private isCurrentlyAttacking = false;
  private isCurrentlyRetreating = false;
  private attackCooldown = 0;

  constructor(
    experimentId: string,
    trialNumber: number,
    aiType: AIType,
    aiLabel: string,
    scenarioId: ExperimentScenarioId,
    scenarioName: string,
    seed: number,
    timeLimitSec: number
  ) {
    this.experimentId = experimentId;
    this.trialNumber = trialNumber;
    this.aiType = aiType;
    this.aiLabel = aiLabel;
    this.scenarioId = scenarioId;
    this.scenarioName = scenarioName;
    this.seed = seed;
    this.timeLimitSec = timeLimitSec;
  }

  public onStep(
    dt: number,
    npcPos: { x: number; y: number },
    npcHealth: number,
    playerHealth: number,
    isRetreatState: boolean,
    isMeleeContact: boolean
  ) {
    this.survivalTime += dt;
    this.finalNpcHealth = Math.max(0, Math.round(npcHealth));
    this.finalPlayerHealth = Math.max(0, Math.round(playerHealth));

    // Distance accumulation
    if (this.lastNpcPos) {
      const dx = npcPos.x - this.lastNpcPos.x;
      const dy = npcPos.y - this.lastNpcPos.y;
      const stepDist = Math.hypot(dx, dy);
      // Filter out teleport/bounds resets > 100
      if (stepDist < 100) {
        this.distanceTravelled += stepDist;
      }
    }
    this.lastNpcPos = { x: npcPos.x, y: npcPos.y };

    // Attack engagements: track discreet attack contacts (debounced)
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }
    if (isMeleeContact && !this.isCurrentlyAttacking && this.attackCooldown <= 0) {
      this.attacks++;
      this.isCurrentlyAttacking = true;
      this.attackCooldown = 0.4;
    } else if (!isMeleeContact) {
      this.isCurrentlyAttacking = false;
    }

    // Retreat transitions: detect edge transition into retreat/healing state
    if (isRetreatState && !this.isCurrentlyRetreating) {
      this.retreats++;
      this.isCurrentlyRetreating = true;
    } else if (!isRetreatState) {
      this.isCurrentlyRetreating = false;
    }
  }

  public recordDamageDealt(amount: number) {
    this.damageDealt += amount;
  }

  public recordDamageReceived(amount: number) {
    this.damageReceived += amount;
  }

  public finalize(outcomeReason?: 'npc_death' | 'player_death' | 'timeout'): TrialResult {
    let outcome: 'NPC Win' | 'Player Win' | 'Timeout (Draw)';
    let npcWon = false;
    let playerWon = false;

    if (this.finalPlayerHealth <= 0) {
      outcome = 'NPC Win';
      npcWon = true;
    } else if (this.finalNpcHealth <= 0) {
      outcome = 'Player Win';
      playerWon = true;
    } else if (this.finalNpcHealth > this.finalPlayerHealth) {
      // At timeout, higher health decides win if not dead
      outcome = 'NPC Win';
      npcWon = true;
    } else if (this.finalPlayerHealth > this.finalNpcHealth) {
      outcome = 'Player Win';
      playerWon = true;
    } else {
      outcome = 'Timeout (Draw)';
    }

    return {
      experimentId: this.experimentId,
      trialNumber: this.trialNumber,
      aiType: this.aiType,
      aiLabel: this.aiLabel,
      scenarioId: this.scenarioId,
      scenarioName: this.scenarioName,
      seed: this.seed,
      survivalTime: Number(this.survivalTime.toFixed(2)),
      damageDealt: Number(this.damageDealt.toFixed(1)),
      damageReceived: Number(this.damageReceived.toFixed(1)),
      npcWon,
      playerWon,
      attacks: this.attacks,
      retreats: this.retreats,
      distanceTravelled: Number(this.distanceTravelled.toFixed(1)),
      duration: Number(this.survivalTime.toFixed(2)),
      finalNpcHealth: this.finalNpcHealth,
      finalPlayerHealth: this.finalPlayerHealth,
      outcome,
      timestamp: Date.now(),
    };
  }
}

// Statistical Helpers
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[], avg: number): number {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function computeAggregates(
  aiType: AIType,
  aiLabel: string,
  trials: TrialResult[]
): AggregatedAIMetrics {
  const count = trials.length;
  if (count === 0) {
    return {
      aiType,
      aiLabel,
      trialCount: 0,
      meanSurvivalTime: 0,
      stdSurvivalTime: 0,
      meanDamageDealt: 0,
      stdDamageDealt: 0,
      meanDamageReceived: 0,
      stdDamageReceived: 0,
      meanAttacks: 0,
      stdAttacks: 0,
      meanRetreats: 0,
      stdRetreats: 0,
      meanDistanceTravelled: 0,
      stdDistanceTravelled: 0,
      npcWinRate: 0,
      playerWinRate: 0,
      drawRate: 0,
    };
  }

  const survivals = trials.map((t) => t.survivalTime);
  const dmgDealts = trials.map((t) => t.damageDealt);
  const dmgReceiveds = trials.map((t) => t.damageReceived);
  const attacksList = trials.map((t) => t.attacks);
  const retreatsList = trials.map((t) => t.retreats);
  const distances = trials.map((t) => t.distanceTravelled);

  const avgSurvival = mean(survivals);
  const avgDmgDealt = mean(dmgDealts);
  const avgDmgReceived = mean(dmgReceiveds);
  const avgAttacks = mean(attacksList);
  const avgRetreats = mean(retreatsList);
  const avgDistance = mean(distances);

  const npcWins = trials.filter((t) => t.npcWon).length;
  const playerWins = trials.filter((t) => t.playerWon).length;
  const draws = trials.filter((t) => !t.npcWon && !t.playerWon).length;

  return {
    aiType,
    aiLabel,
    trialCount: count,
    meanSurvivalTime: Number(avgSurvival.toFixed(2)),
    stdSurvivalTime: Number(stdDev(survivals, avgSurvival).toFixed(2)),
    meanDamageDealt: Number(avgDmgDealt.toFixed(1)),
    stdDamageDealt: Number(stdDev(dmgDealts, avgDmgDealt).toFixed(1)),
    meanDamageReceived: Number(avgDmgReceived.toFixed(1)),
    stdDamageReceived: Number(stdDev(dmgReceiveds, avgDmgReceived).toFixed(1)),
    meanAttacks: Number(avgAttacks.toFixed(1)),
    stdAttacks: Number(stdDev(attacksList, avgAttacks).toFixed(2)),
    meanRetreats: Number(avgRetreats.toFixed(1)),
    stdRetreats: Number(stdDev(retreatsList, avgRetreats).toFixed(2)),
    meanDistanceTravelled: Number(avgDistance.toFixed(1)),
    stdDistanceTravelled: Number(stdDev(distances, avgDistance).toFixed(1)),
    npcWinRate: Number(((npcWins / count) * 100).toFixed(1)),
    playerWinRate: Number(((playerWins / count) * 100).toFixed(1)),
    drawRate: Number(((draws / count) * 100).toFixed(1)),
  };
}

/**
 * Generates RFC 4180 compliant CSV text from an array of TrialResults
 * for direct analysis in Python/Pandas/Matplotlib/Excel.
 */
export function exportTrialsToCSV(trials: TrialResult[]): string {
  const headers = [
    'experiment_id',
    'trial',
    'ai_system',
    'map',
    'seed',
    'survival_time',
    'damage_dealt',
    'damage_received',
    'npc_win',
    'player_win',
    'attacks',
    'retreats',
    'distance_travelled',
    'duration',
    'final_npc_health',
    'final_player_health',
    'outcome',
    'timestamp',
  ];

  const rows = trials.map((t) => [
    t.experimentId,
    t.trialNumber,
    t.aiLabel,
    t.scenarioName,
    t.seed,
    t.survivalTime,
    t.damageDealt,
    t.damageReceived,
    t.npcWon ? 1 : 0,
    t.playerWon ? 1 : 0,
    t.attacks,
    t.retreats,
    t.distanceTravelled,
    t.duration,
    t.finalNpcHealth,
    t.finalPlayerHealth,
    `"${t.outcome}"`,
    t.timestamp,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Triggers a browser download of the CSV data.
 */
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
