# Phase 2: The Five AI Decision Architectures (Python)

## Overview
Phase 2 ports all five game AI decision-making architectures from TypeScript to pure, idiomatic Python. Each engine faithfully adheres to the algorithmic principles of its reference counterpart and produces detailed runtime diagnostic payloads for future frontend inspection and viva demonstration.

All five engines share an identical interface (`BaseAI.evaluate(...)` in `simulation.ai.base`), receiving equivalent world-state information to guarantee fair, rigorous scientific benchmarking.

---

## The 5 AI Architectures

### 1. Simple Decision Logic / FSM ([simulation/ai/simple_fsm.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/ai/simple_fsm.py))
- **Model Type**: Rigid rule-based finite state transitions.
- **States**: `DIRECT_CHASE`, `FLEE_TO_HEAL`, `OBSTACLE_SLIDE`, `EXHAUSTED_STANDOFF`.
- **Behavior**:
  - Immediate transition cliff at $\le 30\%$ HP towards nearest healing shrine.
  - Tangent vector sliding when center whisker detects a barrier ($< 50\text{ px}$).
  - Low CPU overhead, deterministic, but susceptible to boundary jitter and rigid path lock.

### 2. Hierarchical Behavior Tree ([simulation/ai/behavior_tree.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/ai/behavior_tree.py))
- **Model Type**: Priority-ordered composable tree nodes (`SelectorNode`, `SequenceNode`, `ConditionNode`, `ActionNode`).
- **Hierarchy**:
  1. *Root Selector*:
     - **Branch 1 (Survival Sequence)**: Checks HP $\le 35\%$ $\rightarrow$ navigates to and regenerates inside heal shrine.
     - **Branch 2 (Fatigue Recovery Sequence)**: Checks exhaustion flag $\rightarrow$ disengages to tactical standoff ($180\text{ px}$).
     - **Branch 3 (Tactical Obstacle Flank Sequence)**: Checks if line of sight is occluded by a crate $\rightarrow$ finds nearest corner margin and paths around it.
     - **Branch 4 (Action Leaf)**: 5-feeler predictive whisker pursuit.
- **Diagnostic Output**: Full tree node snapshot hierarchy (`SUCCESS`, `FAILURE`, `RUNNING`, `INACTIVE`) and live execution active path.

### 3. Fuzzy Logic Controller ([simulation/ai/fuzzy.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/ai/fuzzy.py))
- **Model Type**: Continuous membership functions (`trimf`, `trapmf`), Mamdani inference, and weighted centroid defuzzification.
- **Input Memberships**:
  - Distance to player: Near ($0-170\text{ px}$), Medium ($110-310\text{ px}$), Far ($250\text{ px}+$).
  - Health: Low ($0-45\%$), Medium ($30-75\%$), High ($60-100\%$).
  - Obstacle Danger: Trapezoidal activation on minimum whisker hit distance.
- **Rule Set**:
  - $R_1$: IF Health Low $\rightarrow$ Retreat & Heal.
  - $R_2$: IF Health Med AND Distance Near $\rightarrow$ Cautious Flank / Orbit.
  - $R_3$: IF Health Med AND Distance Far $\rightarrow$ Balanced Chase.
  - $R_4$: IF Health High AND Distance Far $\rightarrow$ Predictive Intercept.
  - $R_5$: IF Health High AND Distance Near $\rightarrow$ Relentless Ram.
- **Defuzzification**: Blends pursuit, flank, heal, and whisker repulsion vectors smoothly, eliminating discrete boundary oscillation.

### 4. Goal-Oriented Action Planning (GOAP) ([simulation/ai/goap.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/ai/goap.py))
- **Model Type**: A* regression state-space search over symbolic preconditions and postconditions.
- **Goals**:
  - `Survive & Regenerate` (Priority 95 when HP $\le 35\%$, desired state: `{isHealthy: true}`).
  - `Flank Obscured Player` (Priority 70 when line-of-sight is broken, desired state: `{hasLineOfSight: true, inCombatRange: true}`).
  - `Strike Player` (Priority 50 when healthy, desired state: `{inMeleeRange: true}`).
- **Action Pool**: `Navigate to Healing Shrine`, `Regenerate HP in Shrine`, `Corner Flank Maneuver`, `Predictive Intercept Gap`, `Melee Pounce Attack`.
- **Diagnostic Output**: Active goal, goal priority, world state atoms, planned action queue with completion statuses, and plan cost.

### 5. Utility AI ([simulation/ai/utility.py](file:///home/dhanushbvijay/Desktop/AI_Project/simulation/ai/utility.py))
- **Model Type**: Multi-curve continuous scoring with inertia-damped hysteresis.
- **Curves Evaluated**:
  - *Emergency Heal*: Exponential urgency curve $(1 - \text{hp})^{2.2} \times \text{distFactor}$.
  - *Tactical Flank*: Logistic Sigmoid curve on line-of-sight break $\frac{1}{1 + e^{-6(d - 0.3)}}$.
  - *Predictive Intercept*: Linear distance and velocity response curve.
  - *Melee Pounce*: Quadratic proximity curve $(1 - \frac{d}{180})^2 \times \text{health}^{1.2} \times \text{stamina}$.
- **Hysteresis**: $12\%$ inertia bonus to currently active action to prevent high-frequency one-frame action flickering.

---

## Testing & Verification

Run the complete test suite (both Phase 1 physics and Phase 2 AI engines):
```bash
python3 -m unittest discover -s tests -v
```

Total tests: **37 passing (0 failures, 0 errors)**.
