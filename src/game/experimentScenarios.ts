/**
 * Predefined, controlled experimental scenarios for AI evaluation.
 * Every scenario has strictly deterministic initial conditions:
 * fixed entity spawn points, fixed obstacles, fixed healing stations,
 * fixed health pools, and fixed time limits.
 */

import { ExperimentScenarioConfig, ExperimentScenarioId, Crate, HealingStation } from '../types';

export function getExperimentScenario(
  id: ExperimentScenarioId,
  width = 1000,
  height = 700
): ExperimentScenarioConfig {
  switch (id) {
    case 'open_arena': {
      return {
        id: 'open_arena',
        name: 'Scenario 1: Open Arena',
        description: 'Direct combat, open field pursuit, and unconstrained engagement aggression.',
        purpose: 'Measures pursuit speed, line-of-sight interception, and direct combat damage output without obstacle interference.',
        customCrates: [],
        healStations: [],
        npcStartPos: { x: width * 0.2, y: height * 0.5 },
        playerStartPos: { x: width * 0.8, y: height * 0.5 },
        npcInitialHealth: 100,
        playerInitialHealth: 100,
        timeLimitSec: 30,
      };
    }

    case 'obstacle_arena': {
      const crates: Crate[] = [
        { id: 'p1', x: width * 0.28, y: height * 0.25, width: 80, height: 80, label: 'Pillar NW' },
        { id: 'p2', x: width * 0.5 - 40, y: height * 0.25, width: 80, height: 80, label: 'Pillar N' },
        { id: 'p3', x: width * 0.72 - 80, y: height * 0.25, width: 80, height: 80, label: 'Pillar NE' },
        { id: 'p4', x: width * 0.28, y: height * 0.65 - 40, width: 80, height: 80, label: 'Pillar SW' },
        { id: 'p5', x: width * 0.5 - 40, y: height * 0.65 - 40, width: 80, height: 80, label: 'Pillar S' },
        { id: 'p6', x: width * 0.72 - 80, y: height * 0.65 - 40, width: 80, height: 80, label: 'Pillar SE' },
      ];

      return {
        id: 'obstacle_arena',
        name: 'Scenario 2: Obstacle Arena',
        description: 'Symmetrical pillar grid requiring continuous sensory raycast steering.',
        purpose: 'Tests whisker raycast obstacle avoidance, steering jitter vs fluidity, and navigation around static barriers.',
        customCrates: crates,
        healStations: [],
        npcStartPos: { x: width * 0.15, y: height * 0.15 },
        playerStartPos: { x: width * 0.85, y: height * 0.85 },
        npcInitialHealth: 100,
        playerInitialHealth: 100,
        timeLimitSec: 35,
      };
    }

    case 'corridors': {
      const crates: Crate[] = [
        { id: 'cor1', x: width * 0.18, y: height * 0.32, width: width * 0.42, height: 50, label: 'Corridor A' },
        { id: 'cor2', x: width * 0.72, y: height * 0.32, width: width * 0.16, height: 50, label: 'Corridor B' },
        { id: 'cor3', x: width * 0.12, y: height * 0.64, width: width * 0.22, height: 50, label: 'Corridor C' },
        { id: 'cor4', x: width * 0.44, y: height * 0.64, width: width * 0.44, height: 50, label: 'Corridor D' },
        { id: 'cor5', x: width * 0.5 - 25, y: height * 0.12, width: 50, height: 100, label: 'Choke Gate' },
      ];

      return {
        id: 'corridors',
        name: 'Scenario 3: Corridors & Choke Points',
        description: 'Constrained corridors, tight choke passages, and narrow turns.',
        purpose: 'Evaluates spatial adaptation, cornering resilience, and positioning under tight geometric bounds.',
        customCrates: crates,
        healStations: [],
        npcStartPos: { x: width * 0.15, y: height * 0.85 },
        playerStartPos: { x: width * 0.85, y: height * 0.18 },
        npcInitialHealth: 100,
        playerInitialHealth: 100,
        timeLimitSec: 40,
      };
    }

    case 'low_health': {
      const crates: Crate[] = [
        { id: 'c1', x: width * 0.42, y: height * 0.38, width: width * 0.16, height: height * 0.24, label: 'Center Bunker' },
        { id: 'c2', x: width * 0.22, y: height * 0.22, width: 90, height: 160, label: 'West Wall' },
        { id: 'c3', x: width * 0.68, y: height * 0.52, width: 90, height: 160, label: 'East Wall' },
      ];

      const healStations: HealingStation[] = [
        {
          id: 'heal_nw',
          label: 'Sanctuary NW',
          x: 45,
          y: 45,
          width: 120,
          height: 120,
          healRatePerSec: 30,
          color: '#10b981',
        },
      ];

      return {
        id: 'low_health',
        name: 'Scenario 4: Low-Health Survival',
        description: 'NPC starts at critical 25% health with a distant healing sanctuary.',
        purpose: 'Measures self-preservation triggering, retreat execution, healing station pathfinding, and risk mitigation.',
        customCrates: crates,
        healStations,
        npcStartPos: { x: width * 0.5, y: height * 0.5 },
        playerStartPos: { x: width * 0.8, y: height * 0.5 },
        npcInitialHealth: 25,
        playerInitialHealth: 100,
        timeLimitSec: 35,
      };
    }

    case 'healing_shrines': {
      const crates: Crate[] = [
        { id: 's1', x: width * 0.28, y: height * 0.45, width: 90, height: 90 },
        { id: 's2', x: width * 0.62, y: height * 0.45, width: 90, height: 90 },
      ];

      const healStations: HealingStation[] = [
        {
          id: 'heal_alpha',
          label: 'Shrine Alpha',
          x: 50,
          y: 50,
          width: 110,
          height: 110,
          healRatePerSec: 25,
          color: '#10b981',
        },
        {
          id: 'heal_beta',
          label: 'Shrine Beta',
          x: width - 160,
          y: height - 160,
          width: 110,
          height: 110,
          healRatePerSec: 25,
          color: '#10b981',
        },
      ];

      return {
        id: 'healing_shrines',
        name: 'Scenario 5: Healing Shrines (50% HP)',
        description: 'Both entities start at 50% HP with two active healing shrines.',
        purpose: 'Compares dynamic balancing between attacking wounded player vs retreating to recover health.',
        customCrates: crates,
        healStations,
        npcStartPos: { x: width * 0.2, y: height * 0.75 },
        playerStartPos: { x: width * 0.8, y: height * 0.25 },
        npcInitialHealth: 50,
        playerInitialHealth: 50,
        timeLimitSec: 40,
      };
    }
  }
}

export const ALL_SCENARIOS: ExperimentScenarioId[] = [
  'open_arena',
  'obstacle_arena',
  'corridors',
  'low_health',
  'healing_shrines',
];
