# NPC Steering & Driving AI Demo

A top-down 2D real-time simulation and comparison sandbox pitting 5 distinct Game AI architectures against each other in an obstacle-filled survival arena.

The demo lets you test, inspect, and benchmark how different decision-making and steering algorithms handle dynamic combat, ray-cast obstacle avoidance, multi-agent anti-stacking physics, health recovery loops, and aggression stamina limits.

---

## 🎮 Live Demo Overview

Players control a survival survivor moving through an arena populated with destructible obstacles, healing stations, and enemy NPCs driven by five independent AI architectures.

### The 5 AI Architectures Compared

| Architecture | Model Type | Key Strengths & Behavior |
| :--- | :--- | :--- |
| **Simple Decision Logic (FSM)** | Rule-based state machine / if-else branches | Ultra low CPU overhead; predictable; executes immediate transitions between direct chase, low-health flight, and tired standoff. |
| **Behavior Trees (BT)** | Hierarchical priority-selector tree | Highly modular and readable; prioritizes self-preservation (healing & fatigue recovery) above tactical corner flanking and whisker predictive chase. |
| **Fuzzy Logic** | Multi-rule membership functions with defuzzification | Smooth blending between contradictory behaviors (e.g. retreating while flanking or cautious stalking); avoids binary state jitter. |
| **Goal-Oriented Action Planning (GOAP)** | A* regression search over world state preconditions | Long-term strategic foresight; dynamically plans sequence chains (e.g. `FindHealStation` -> `TravelToHeal` -> `RegenHealth` -> `Re-arm` -> `EngageMelee`). |
| **Utility AI** | Multi-factor mathematical response curves | Continuous evaluation of conflicting desires (proximity quadratic dropoff, health confidence, threat level) selecting the highest-scoring action each frame. |

---

## ⚡ Key Gameplay & Simulation Mechanics

- **Aggression Stamina System**:
  - NPCs possess a 4.0-second sprint/aggression stamina meter.
  - High-intensity behaviors (pounces, interception sprints, relentless pursuit) deplete stamina.
  - When stamina drops to zero, the NPC enters an **Exhausted** state (`⚡ Tired`), drops to $55\%$ speed, disengages to a tactical standoff, and catches its breath until regenerating past $50\%$ stamina.
- **Ray-Cast Whisker Obstacle Avoidance**:
  - Each NPC projects a forward array of multi-angle ray sensors that detect crates and perimeter walls in real-time, calculating repulsion vectors and steering forces.
- **Anti-Stacking & Crowd Flocking**:
  - Continuous circle-circle separation forces and collision impulses prevent agents from stacking inside one another or clustering into identical conga-lines.
- **Interactive Healing Stations**:
  - Low-health NPCs seek out active green medical zones to regenerate HP. Once fully restored, they re-engage combat.
- **Player Combat & Projectiles**:
  - Fire projectiles, test line-of-sight breaking around crates, and monitor how each AI adapts to damage and fleeing states.

---

## 🔍 Live Inspector & Debugging Suite

The application includes an in-depth diagnostic HUD and inspection sidebar:

- **Ray Sensor Visualization**: Toggle sensory whiskers, hit points, and surface normals on/off.
- **Vector Overlays**: Real-time rendering of desired velocity, steering force, separation force, and target points.
- **Health & Stamina Meters**: Overhead canvas bars showing live HP (green/amber/red) and aggression stamina (cyan/orange).
- **Architecture Deep-Dive Inspector**:
  - **Behavior Tree**: Interactive visual node graph displaying execution states (`SUCCESS`, `RUNNING`, `FAILURE`) in real-time.
  - **Fuzzy Logic**: Live membership curve gauges (Close, Medium, Far, Critical HP, Aggression weights).
  - **Utility AI**: Real-time score curves and winner action selection.
  - **GOAP**: Current active goal, planned action queue, and world state condition assertions.
  - **Simple Logic**: State transitions and transition triggers.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: [React 19](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Canvas Rendering**: High-performance HTML5 Canvas 2D engine with sub-pixel vector physics
- **Icons & UI**: [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm` or `bun`

### Installation

1. Clone or download the repository:
   ```bash
   git clone <repo-url>
   cd <repo-folder>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

- `npm run dev`: Starts the Vite development server on port 3000.
- `npm run build`: Compiles TypeScript and builds the production bundle into `dist/`.
- `npm run preview`: Locally previews the production build.
- `npm run lint`: Runs `tsc --noEmit` to validate types.

---

## 🔬 Controlled Evaluation & Experiments Framework (P0 Evaluation)

The application features a scientific benchmarking suite designed to directly answer:
> *"How does fuzzy-logic decision making affect NPC behavior compared with alternative AI decision architectures?"*

### Features:
- **5 Standardized Benchmark Scenarios**:
  1. `open_arena`: Wide open plain testing pure pursuit, reaction velocity, and evasive stamina.
  2. `obstacle_arena`: Scattered tactical crate barriers testing whisker steering & raycast navigation.
  3. `corridors`: Narrow choke passages evaluating corner entrapment and pathfinding recovery.
  4. `low_health`: Spawns NPC at $25\%$ HP with player at $100\%$ HP, testing self-preservation decisions under mortal threat.
  5. `healing_shrines`: Dual health shrines testing spatial navigation and contestation over medical resources.
- **Automated Deterministic Benchmark Opponent**:
  - Replaces human player variation with an automated benchmark agent (kiting at optimal range, deterministic shockwave EMP defenses, and obstacle avoidance).
  - Guarantees 100% identical test conditions across every trial and AI system.
- **Two Execution Modes**:
  - **⚡ Accelerated**: Runs micro-tick batches headless in seconds without freezing the UI.
  - **👁 Visual 1x**: Steps in real-time so researchers can visually observe tactical navigation decisions.
- **Metrics Tracked**:
  - Survival time (seconds, mean $\pm$ std)
  - Damage dealt to player
  - Damage received by NPC
  - Attack contacts & retreat decisions
  - Cumulative distance travelled
  - Win / Loss / Draw percentages
- **Direct CSV Data Export**:
  - Click **Export Raw Trial Data (CSV)** to download structured `.csv` records ready for statistical analysis in Python, Pandas, Matplotlib, or R.

---

## 📂 Project Structure

```
├── src/
│   ├── ai/                      # AI Architecture Implementations
│   │   ├── behaviorTree.ts      # Behavior Tree nodes (Selector, Sequence, Action, Condition)
│   │   ├── fuzzy.ts             # Fuzzy sets, membership functions, inference engine
│   │   ├── goap.ts              # GOAP Planner, A* action graph, world state evaluator
│   │   ├── simpleLogic.ts       # Finite-state rule-based decision logic
│   │   └── utility.ts           # Utility response curves and scorer
│   ├── components/              # UI & Canvas Components
│   │   ├── AIDebugPanel.tsx     # Deep-dive inspector for all 5 architectures
│   │   ├── ControlsToolbar.tsx  # Map controls, visual toggles, spawn actions
│   │   ├── GameCanvas.tsx       # HTML5 canvas rendering loop & vector overlays
│   │   └── GameHUD.tsx          # Real-time game metrics and player health display
│   ├── game/
│   │   ├── GameEngine.ts        # Physics loop, steering integration, collision solver
│   │   └── mapLayouts.ts        # Preset map configurations (Arena, Corridors, Maze)
│   ├── utils/                   # Vector math helpers and ray intersection utilities
│   ├── types.ts                 # Shared TypeScript interfaces for AI states & entities
│   ├── App.tsx                  # Main layout and state coordinator
│   └── main.tsx                 # React entry point
├── package.json
└── vite.config.ts
```

---

## 🎯 Controls

- **W, A, S, D** or **Arrow Keys**: Move survivor player
- **Left Mouse Click / Tap**: Fire blaster projectile toward cursor
- **NPC Selection**: Click any NPC on the canvas to inspect its internal decision graph in the sidebar
- **Toolbar Toggles**: Switch maps, pause/resume simulation, toggle health/stamina bars, ray sensors, and vector lines
