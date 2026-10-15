# NPC Mechanism Metrics Plan

This document outlines the metrics we will compute from the simulation logs to prove the effectiveness of advanced mechanisms (Fuzzy Logic, Utility, GOAP) over the baseline FSM.

## Planned Metrics

### 1. Oscillation Count (The Target Metric)
*   **Definition**: How often an NPC's action flips between two different state priorities within N ticks.
*   **Why it matters**: FSMs suffer from hard threshold boundaries. An NPC with 61 hunger will seek food, eat, drop to 36 hunger, then if thirst is 61, immediately seek water. This causes them to bounce rapidly between resources.
*   **Computation**: Count instances where `action_t != action_{t-1}` and the action returns to `action_{t-2}` within a 10-tick window. Fuzzy logic should significantly smooth this out.

### 2. Latency (Reaction Time)
*   **Definition**: Time taken (in ticks) from a threat appearing within `THREAT_NEAR` distance to the NPC selecting the `flee` action.
*   **Why it matters**: Ensures the AI remains responsive to critical events even if their current goal (e.g., eating) is highly salient.

### 3. Goal Satisfaction / Stability
*   **Definition**: The average duration (in ticks) an NPC spends in an "idle" or "wander" state, indicating all needs are adequately met.
*   **Why it matters**: Higher stability means the mechanism is better at prioritizing and fulfilling needs efficiently.

### 4. Survival Rate
*   **Definition**: Percentage of NPCs alive at the end of the `MAX_TICKS` simulation limit.
*   **Why it matters**: The ultimate baseline test. If a complex mechanism causes mass death compared to the FSM, it is failing at basic survival.

### 5. Threat Response Time
*   **Definition**: Average distance maintained from threats over the simulation.
*   **Why it matters**: A more intelligent mechanism might pre-emptively route around threats rather than just reacting when they cross a hard boundary.

### 6. Interpretability (Qualitative)
*   **Definition**: How easy it is to look at the brain's decision weights (or rules) and understand *why* it made a choice.
*   **Why it matters**: GOAP and Utility systems provide numeric scores or explicit plans, making debugging easier than tracing complex FSM graphs.
