/**
 * Map presets with crates (obstacles) and healing stations for the AI demo.
 */

import { Crate, HealingStation, CratePreset } from '../types';

export interface MapConfig {
  width: number;
  height: number;
  crates: Crate[];
  healStations: HealingStation[];
}

export function getMapLayout(preset: CratePreset, width = 1000, height = 700): MapConfig {
  const healStations: HealingStation[] = [
    {
      id: 'heal_alpha',
      label: 'Shrine Alpha (Heal Zone)',
      x: 45,
      y: 45,
      width: 110,
      height: 110,
      healRatePerSec: 25,
      color: '#10b981', // Emerald green
    },
    {
      id: 'heal_beta',
      label: 'Shrine Beta (Heal Zone)',
      x: width - 155,
      y: height - 155,
      width: 110,
      height: 110,
      healRatePerSec: 25,
      color: '#10b981',
    },
  ];

  let crates: Crate[] = [];

  switch (preset) {
    case 'tactical':
      crates = [
        // Center bunker
        { id: 'c1', x: width * 0.42, y: height * 0.38, width: width * 0.16, height: height * 0.24, label: 'Central Bunker' },
        // Left barrier
        { id: 'c2', x: width * 0.22, y: height * 0.22, width: 90, height: 160, label: 'West Wall' },
        // Right barrier
        { id: 'c3', x: width * 0.68, y: height * 0.52, width: 90, height: 160, label: 'East Wall' },
        // Top tactical crate
        { id: 'c4', x: width * 0.52, y: height * 0.12, width: 140, height: 75, label: 'North Crate' },
        // Bottom tactical crate
        { id: 'c5', x: width * 0.28, y: height * 0.74, width: 150, height: 75, label: 'South Crate' },
        // Corner cover
        { id: 'c6', x: width * 0.82, y: height * 0.18, width: 80, height: 80, label: 'NE Block' },
        { id: 'c7', x: width * 0.12, y: height * 0.65, width: 80, height: 80, label: 'SW Block' },
      ];
      break;

    case 'pillars':
      crates = [
        // 2x3 Grid of symmetrical pillars
        { id: 'p1', x: width * 0.28, y: height * 0.25, width: 80, height: 80, label: 'Pillar 1' },
        { id: 'p2', x: width * 0.50 - 40, y: height * 0.25, width: 80, height: 80, label: 'Pillar 2' },
        { id: 'p3', x: width * 0.72 - 80, y: height * 0.25, width: 80, height: 80, label: 'Pillar 3' },

        { id: 'p4', x: width * 0.28, y: height * 0.65 - 40, width: 80, height: 80, label: 'Pillar 4' },
        { id: 'p5', x: width * 0.50 - 40, y: height * 0.65 - 40, width: 80, height: 80, label: 'Pillar 5' },
        { id: 'p6', x: width * 0.72 - 80, y: height * 0.65 - 40, width: 80, height: 80, label: 'Pillar 6' },
      ];
      break;

    case 'corridors':
      crates = [
        // Horizontal corridors with staggered choke points
        { id: 'cor1', x: width * 0.18, y: height * 0.32, width: width * 0.42, height: 50, label: 'Corridor A' },
        { id: 'cor2', x: width * 0.72, y: height * 0.32, width: width * 0.16, height: 50, label: 'Corridor B' },
        { id: 'cor3', x: width * 0.12, y: height * 0.64, width: width * 0.22, height: 50, label: 'Corridor C' },
        { id: 'cor4', x: width * 0.44, y: height * 0.64, width: width * 0.44, height: 50, label: 'Corridor D' },
        // Vertical divider
        { id: 'cor5', x: width * 0.50 - 25, y: height * 0.12, width: 50, height: 100, label: 'Choke Gate' },
      ];
      break;

    case 'scattered':
    default:
      crates = [
        { id: 's1', x: width * 0.25, y: height * 0.2, width: 70, height: 110 },
        { id: 's2', x: width * 0.45, y: height * 0.15, width: 110, height: 70 },
        { id: 's3', x: width * 0.65, y: height * 0.25, width: 80, height: 80 },
        { id: 's4', x: width * 0.2, y: height * 0.55, width: 130, height: 60 },
        { id: 's5', x: width * 0.48, y: height * 0.45, width: 90, height: 90 },
        { id: 's6', x: width * 0.72, y: height * 0.6, width: 75, height: 120 },
        { id: 's7', x: width * 0.38, y: height * 0.72, width: 100, height: 65 },
      ];
      break;
  }

  return {
    width,
    height,
    crates,
    healStations,
  };
}
