# Phase 1: Python Simulation Engine & Math Core Documentation

## Overview
Phase 1 implements the complete 2D continuous simulation physics, geometry, raycasting, anti-stacking crowd dynamics, stamina systems, and health/healing mechanics in pure Python.

The module is decoupled from React, FastAPI, WebSockets, and Pygame, allowing direct standalone execution and deterministic automated testing.

---

## Implemented Modules

### 1. `simulation.vector2` ([simulation/vector2.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/vector2.py))
- Vector arithmetic: addition, subtraction, scalar multiplication, division, negation.
- Norms and distances: `length()`, `length_sq()`, `distance()`, `distance_sq()`.
- Geometric operations: `normalize()`, `dot()`, `cross()`, `clamp_length()`, `rotate()`, `lerp()`, heading angles.
- Zero-allocation slots (`__slots__`) for high performance.

### 2. `simulation.geometry` ([simulation/geometry.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/geometry.py))
- `AABB`: Axis-aligned bounding box for crates and healing zones with containment checks.
- `ray_intersect_aabb`: Ray-AABB intersection test returning distance, hit coordinate, and surface normal vector.
- `resolve_box_collision`: Solid non-penetration resolver pushing overlapping circles/boxes out along the shortest normal.
- `has_line_of_sight`: Ray segment casting checking if obstacles block sight between two points.

### 3. `simulation.entities` ([simulation/entities.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/entities.py))
- `Entity`: Base class with continuous coordinates (`pos`), velocity (`vel`), rotation, health, and max health.
- `Player`: Player entity with acceleration, friction, max speed ($230\text{ px/s}$), pulse cooldowns, and damage flash.
- `NPC`: AI agent with 5-feeler forward whisker ray sensors, speed tuning per algorithm type ($175-190\text{ px/s}$), aggression stamina ($4.0\text{s}$ sprint buffer), exhaustion flag, and serializable `debug_data` dictionary.
- `HealingStation`: AABB healing zone with continuous regeneration rate ($25-30\text{ HP/s}$).
- `Crate`: Static obstacle barrier.

### 4. `simulation.layouts` ([simulation/layouts.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/layouts.py))
- Arena presets matching reference project geometry ($1000 \times 700\text{ px}$):
  - `tactical`: Central bunker, corner blocks, and lateral barriers.
  - `pillars`: $2 \times 3$ symmetrical pillar grid.
  - `corridors`: Horizontal passages with choke gate.
  - `scattered`: Scattered cover blocks.

### 5. `simulation.scenarios` ([simulation/scenarios.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/scenarios.py))
- Standardized, deterministic experimental benchmark scenarios:
  - `open_arena`
  - `obstacle_arena`
  - `corridors`
  - `low_health`
  - `dynamic_crossfire`

### 6. `simulation.simulation_engine` ([simulation/simulation_engine.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/simulation_engine.py))
- `SimulationEngine`:
  - `step(dt, move_x, move_y)`: Master atomic simulation tick.
  - `update_sensors(npc)`: Whisker raycasting against obstacles and outer walls.
  - Flocking anti-stacking separation forces ($r=52\text{px}$, quadratic falloff).
  - 2-pass multi-agent solid non-penetration impulse resolution.
  - Aggression stamina drain under high-intensity sprint, exhaustion speed penalties ($55\%$), and $50\%$ recovery threshold.
  - Healing station HP recovery.
  - Melee combat damage ($22\text{ HP/s}$) and knockback.
  - `trigger_player_pulse()` shockwave damage and knockback.
  - `get_state_snapshot()`: JSON-ready serialized snapshot for future WebSocket streaming.

---

## How to Run the Tests

From the project root:
```bash
python3 -m unittest discover -s tests -v
```

---

## Assumptions & Deferred Items

### Assumptions
- Arena coordinates default to $1000 \times 700\text{ px}$ to match the reference project's canvas dimensions.
- Time delta `dt` is clamped to $\le 0.05\text{ s}$ ($20\text{ FPS}$ lower bound) to prevent physics tunneling during lag spikes.
- The simulation engine uses a pluggable controller callback dictionary `ai_controllers[npc.id]` matching the design of `mechanisms/base.py`.

### Deferred to Phase 2+
- Porting the 5 AI decision engines into Python (`FSM`, `BehaviorTree`, `FuzzyLogic`, `GOAP`, `UtilityAI`).
- Automated benchmark runner and statistical trial aggregator.
- FastAPI REST / WebSocket endpoints.
- React frontend adaptation.
