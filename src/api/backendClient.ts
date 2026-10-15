/**
 * API client and WebSocket service connecting the React frontend
 * to the Python FastAPI simulation and benchmark backend.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8001`
    : 'http://127.0.0.1:8001');

export const WS_BASE_URL =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8001`
    : 'ws://127.0.0.1:8001');

export interface ServerStatus {
  status: string;
  simulation_running: boolean;
  simulation_paused: boolean;
  benchmark_running: boolean;
  connected_clients: number;
  current_scenario: string;
  active_npcs: number;
}

export interface ScenarioMeta {
  id: string;
  name: string;
  description: string;
  purpose: string;
  time_limit_sec: number;
  crates_count: number;
  heal_stations_count: number;
  npc_start_pos: { x: number; y: number };
  player_start_pos: { x: number; y: number };
  npc_initial_health: number;
  player_initial_health: number;
}

export interface BenchmarkProgress {
  completed: number;
  total: number;
  current: string;
  percent: number;
}

export interface BenchmarkStatus {
  isRunning: boolean;
  progress: BenchmarkProgress;
  hasResult: boolean;
  experimentId: string | null;
}

export class BackendClient {
  public static async getStatus(): Promise<ServerStatus> {
    const res = await fetch(`${API_BASE_URL}/api/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async getScenarios(): Promise<ScenarioMeta[]> {
    const res = await fetch(`${API_BASE_URL}/api/scenarios`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async getAITypes(): Promise<{ id: string; name: string; description: string }[]> {
    const res = await fetch(`${API_BASE_URL}/api/ai-types`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async configureSimulation(config: {
    scenario_id?: string;
    width?: number;
    height?: number;
    npcs?: any[];
    fps?: number;
  }): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async controlSimulation(action: string, extra?: Record<string, any>): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async sendPlayerMove(move_x: number, move_y: number): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/player-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move_x, move_y }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async getSimulationSnapshot(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/simulation/snapshot`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async startBenchmark(
    scenario_id: string,
    trials_per_ai: number,
    ai_types?: string[]
  ): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/benchmark/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id,
        trials_per_ai,
        ai_types: ai_types && ai_types.length > 0 ? ai_types : null,
      }),
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async cancelBenchmark(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/benchmark/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async getBenchmarkStatus(): Promise<BenchmarkStatus> {
    const res = await fetch(`${API_BASE_URL}/api/benchmark/status`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static async getBenchmarkResults(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/benchmark/results`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  }

  public static getTrialsCSVUrl(): string {
    return `${API_BASE_URL}/api/benchmark/export/trials.csv`;
  }

  public static getAggregatesCSVUrl(): string {
    return `${API_BASE_URL}/api/benchmark/export/aggregates.csv`;
  }
}

/**
 * WebSocket simulation connection manager.
 */
export class BackendWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private url: string;
  public onStateUpdate?: (data: any) => void;
  public onConnectionChange?: (connected: boolean) => void;

  constructor(url: string = `${WS_BASE_URL}/ws/simulation`) {
    this.url = url;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        if (this.onConnectionChange) this.onConnectionChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'state_update' && this.onStateUpdate) {
            this.onStateUpdate(msg.data);
          }
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        if (this.onConnectionChange) this.onConnectionChange(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = (e) => {
        console.warn('WebSocket error:', e);
        if (this.ws) this.ws.close();
      };
    } catch (err) {
      console.warn('WebSocket connect error:', err);
      this.scheduleReconnect();
    }
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }
}
