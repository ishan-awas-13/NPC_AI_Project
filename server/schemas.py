"""
Pydantic data models and schemas for FastAPI REST endpoints and WebSocket protocols.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# --- REST Request & Response Models ---

class NPCConfig(BaseModel):
    id: str
    ai_type: str = Field(..., description="AI type: fsm/simple, behavior_tree, fuzzy, goap, utility")
    x: Optional[float] = None
    y: Optional[float] = None
    name: Optional[str] = None
    color: Optional[str] = None
    accent_color: Optional[str] = None


class SimulationConfigRequest(BaseModel):
    scenario_id: Optional[str] = None
    preset: Optional[str] = None
    width: float = 1000.0
    height: float = 700.0
    npcs: Optional[List[NPCConfig]] = None
    fps: int = 30


class SimulationControlRequest(BaseModel):
    action: str = Field(..., description="Action: start, pause, resume, reset, step, trigger_pulse")


class PlayerMoveRequest(BaseModel):
    move_x: float = Field(0.0, description="Movement along X axis: -1.0 to 1.0")
    move_y: float = Field(0.0, description="Movement along Y axis: -1.0 to 1.0")


class BenchmarkStartRequest(BaseModel):
    scenario_id: str = "open_arena"
    trials_per_ai: int = Field(5, ge=1, le=50)
    ai_types: Optional[List[str]] = None


class ScenarioInfo(BaseModel):
    id: str
    name: str
    description: str
    purpose: str
    time_limit_sec: float
    crates_count: int
    heal_stations_count: int
    npc_start_pos: Dict[str, float]
    player_start_pos: Dict[str, float]
    npc_initial_health: float
    player_initial_health: float


class AIAvailableInfo(BaseModel):
    id: str
    name: str
    description: str


class ServerStatusResponse(BaseModel):
    status: str
    simulation_running: bool
    simulation_paused: bool
    benchmark_running: bool
    connected_clients: int
    current_scenario: str
    active_npcs: int
