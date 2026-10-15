import pandas as pd
import matplotlib.pyplot as plt
import glob
import os
import sys

def analyze():
    log_files = glob.glob("logs/*.csv")
    if not log_files:
        print("No CSV logs found in logs/ directory.")
        sys.exit(1)
        
    latest_log = max(log_files, key=os.path.getmtime)
    print(f"Analyzing {latest_log}...")
    
    df = pd.read_csv(latest_log)
    
    # 1. Plot needs over time for a single NPC (e.g., NPC 0)
    npc_0 = df[df['npc_id'] == 0]
    
    plt.figure(figsize=(10, 6))
    plt.plot(npc_0['tick'], npc_0['hunger'], label='Hunger', color='green')
    plt.plot(npc_0['tick'], npc_0['thirst'], label='Thirst', color='blue')
    plt.plot(npc_0['tick'], npc_0['energy'], label='Energy', color='orange')
    plt.axhline(60, color='r', linestyle='--', alpha=0.5, label='FSM Threshold (60)')
    plt.axhline(30, color='purple', linestyle='--', alpha=0.5, label='Energy Threshold (30)')
    
    plt.title("NPC 0 Needs Over Time (FSM)")
    plt.xlabel("Tick")
    plt.ylabel("Need Value")
    plt.legend()
    plt.grid(True)
    plt.savefig("docs/needs_over_time.png")
    print("Saved docs/needs_over_time.png")
    
    # 2. Action frequency histogram
    plt.figure(figsize=(8, 5))
    df['action'].value_counts().plot(kind='bar', color='skyblue')
    plt.title("Action Frequency Histogram")
    plt.xlabel("Action")
    plt.ylabel("Frequency")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig("docs/action_histogram.png")
    print("Saved docs/action_histogram.png")
    
    # 3. Compute Oscillation Count
    # Oscillation definition: action changes from A to B, and back to A within 10 ticks.
    oscillation_count = 0
    
    for npc_id in df['npc_id'].unique():
        npc_data = df[df['npc_id'] == npc_id].sort_values('tick').reset_index(drop=True)
        actions = npc_data['action'].tolist()
        
        # Look for A -> B -> A pattern within a small window
        for i in range(len(actions) - 2):
            a1 = actions[i]
            # find next different action
            j = i + 1
            while j < len(actions) and actions[j] == a1:
                j += 1
            if j >= len(actions): break
            a2 = actions[j]
            
            # find next different action
            k = j + 1
            while k < len(actions) and actions[k] == a2:
                k += 1
            if k >= len(actions): break
            a3 = actions[k]
            
            if a1 == a3 and a1 != "wander" and a1 != "idle" and (k - i) <= 15:
                # To prevent double counting the same oscillation event, we could step forward,
                # but a simple count of this pattern gives a good raw metric.
                oscillation_count += 1
                
    print(f"\n--- Metrics ---")
    print(f"Oscillation Count: {oscillation_count}")
    print("Interpretation: A high oscillation count means the NPC frequently bounces back and forth between two urgent needs (e.g. food and water) due to hard thresholds, failing to fully satisfy either efficiently.")

if __name__ == "__main__":
    analyze()
