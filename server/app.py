"""
FastAPI application defining REST API endpoints and WebSocket connection handler.
Integrates SimulationSessionManager and BenchmarkSessionManager cleanly.
"""
import json
import logging
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from server.schemas import (
    SimulationConfigRequest,
    SimulationControlRequest,
    PlayerMoveRequest,
    BenchmarkStartRequest,
    ServerStatusResponse,
    ScenarioInfo,
    AIAvailableInfo,
)
from server.simulation_session import SimulationSessionManager
from server.benchmark_session import BenchmarkSessionManager
from simulation.scenarios import get_experiment_scenario
from simulation.ai.factory import AI_REGISTRY

logger = logging.getLogger("api_server")

app = FastAPI(
    title="NPC AI Comparison Platform - Backend API",
    description="REST & WebSocket API for 2D Continuous Steering Physics and Deterministic AI Comparison",
    version="1.0.0",
)

# Enable CORS for future React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global session instances
sim_session = SimulationSessionManager()
benchmark_session = BenchmarkSessionManager()

ALL_SCENARIOS = [
    "open_arena",
    "obstacle_arena",
    "corridors",
    "low_health",
    "dynamic_crossfire",
]

AI_DESCRIPTIONS = {
    "fsm": ("Finite State Machine", "Rigid threshold state transitions with fallback wall-sliding maneuvers."),
    "simple": ("Simple Decision Logic", "Direct hierarchical condition checks (low health, stamina, melee range)."),
    "behavior_tree": ("Behavior Tree", "Hierarchical composite selector-sequence nodes with fallback decorator gates."),
    "fuzzy": ("Fuzzy Logic Controller", "Continuous multi-variable membership functions with defuzzification."),
    "goap": ("Goal-Oriented Action Planning", "A* search over forward-projected world state preconditions and effects."),
    "utility": ("Utility AI Curves", "Continuous mathematical response curves with exponential weight scoring."),
}


@app.on_event("shutdown")
async def shutdown_event():
    await sim_session.stop()
    await benchmark_session.cancel_benchmark()


# --- Health & Metadata Endpoints ---

@app.get("/api/status", response_model=ServerStatusResponse)
async def get_status():
    return ServerStatusResponse(
        status="ok",
        simulation_running=sim_session.is_running,
        simulation_paused=sim_session.is_paused,
        benchmark_running=benchmark_session.is_running,
        connected_clients=sim_session.client_count,
        current_scenario=sim_session.scenario_id,
        active_npcs=len(sim_session.engine.npcs),
    )


@app.get("/api/scenarios", response_model=List[ScenarioInfo])
async def list_scenarios():
    scenarios = []
    for sc_id in ALL_SCENARIOS:
        sc = get_experiment_scenario(sc_id, sim_session.width, sim_session.height)
        scenarios.append(ScenarioInfo(
            id=sc.id,
            name=sc.name,
            description=sc.description,
            purpose=sc.purpose,
            time_limit_sec=sc.time_limit_sec,
            crates_count=len(sc.crates),
            heal_stations_count=len(sc.heal_stations),
            npc_start_pos={"x": sc.npc_start_pos.x, "y": sc.npc_start_pos.y},
            player_start_pos={"x": sc.player_start_pos.x, "y": sc.player_start_pos.y},
            npc_initial_health=sc.npc_initial_health,
            player_initial_health=sc.player_initial_health,
        ))
    return scenarios


@app.get("/api/ai-types", response_model=List[AIAvailableInfo])
async def list_ai_types():
    return [
        AIAvailableInfo(
            id=key,
            name=AI_DESCRIPTIONS.get(key, (key, ""))[0],
            description=AI_DESCRIPTIONS.get(key, (key, ""))[1],
        )
        for key in ["fsm", "behavior_tree", "fuzzy", "goap", "utility"]
    ]


# --- Interactive Simulation Control Endpoints ---

@app.post("/api/simulation/configure")
async def configure_simulation(config: SimulationConfigRequest):
    custom_npcs = [npc.model_dump() for npc in config.npcs] if config.npcs else None
    snapshot = await sim_session.configure(
        scenario_id=config.scenario_id,
        width=config.width,
        height=config.height,
        custom_npcs=custom_npcs,
        fps=config.fps,
    )
    return {"status": "configured", "snapshot": snapshot}


@app.post("/api/simulation/control")
async def control_simulation(req: SimulationControlRequest):
    action = req.action.lower()
    if action == "start":
        return await sim_session.start()
    elif action == "pause":
        return await sim_session.pause()
    elif action == "resume":
        return await sim_session.resume()
    elif action == "reset":
        return await sim_session.reset()
    elif action == "step":
        return await sim_session.step_once()
    elif action == "trigger_pulse":
        return await sim_session.trigger_pulse()
    elif action == "stop":
        return await sim_session.stop()
    elif action == "spawn_npc":
        ai_type = getattr(req, "ai_type", None) or "fuzzy"
        return await sim_session.spawn_npc(ai_type)
    elif action == "remove_npc":
        ai_type = getattr(req, "ai_type", None)
        return await sim_session.remove_npc(ai_type=ai_type)
    elif action == "damage_all":
        return await sim_session.damage_npc(amount=45.0)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown action: '{action}'. Valid actions are start, pause, resume, reset, step, trigger_pulse, stop, spawn_npc, remove_npc, damage_all."
        )


@app.post("/api/simulation/player-move")
async def player_move(req: PlayerMoveRequest):
    sim_session.set_player_input(req.move_x, req.move_y)
    return {"status": "ok", "move_x": req.move_x, "move_y": req.move_y}


@app.get("/api/simulation/snapshot")
async def get_simulation_snapshot():
    return sim_session.engine.get_state_snapshot()


# --- Headless Benchmark Endpoints ---

@app.post("/api/benchmark/start")
async def start_benchmark(req: BenchmarkStartRequest):
    if req.scenario_id not in ALL_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scenario '{req.scenario_id}'. Valid scenarios: {ALL_SCENARIOS}"
        )
    return await benchmark_session.start_benchmark(
        scenario_id=req.scenario_id,
        trials_per_ai=req.trials_per_ai,
        ai_types=req.ai_types,
    )


@app.post("/api/benchmark/cancel")
async def cancel_benchmark():
    return await benchmark_session.cancel_benchmark()


@app.get("/api/benchmark/status")
async def benchmark_status():
    return benchmark_session.get_status()


@app.get("/api/benchmark/results")
async def benchmark_results():
    results = benchmark_session.get_results()
    if not results:
        raise HTTPException(status_code=404, detail="No completed benchmark results available.")
    return results


@app.get("/api/benchmark/export/trials.csv")
async def export_trials_csv():
    csv_data = benchmark_session.get_csv_trials()
    if not csv_data:
        raise HTTPException(status_code=404, detail="No trial data to export. Run a benchmark first.")
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=benchmark_trials.csv"}
    )


@app.get("/api/benchmark/export/aggregates.csv")
async def export_aggregates_csv():
    csv_data = benchmark_session.get_csv_aggregates()
    if not csv_data:
        raise HTTPException(status_code=404, detail="No aggregate data to export. Run a benchmark first.")
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=benchmark_aggregates.csv"}
    )


# --- WebSocket Streaming Endpoint ---

@app.websocket("/ws/simulation")
async def simulation_websocket(websocket: WebSocket):
    await sim_session.connect_client(websocket)
    try:
        while True:
            # Client can send real-time control messages over WebSocket
            text_data = await websocket.receive_text()
            try:
                msg = json.loads(text_data)
                msg_type = msg.get("type")

                if msg_type == "player_input":
                    move_x = msg.get("move_x", 0.0)
                    move_y = msg.get("move_y", 0.0)
                    sim_session.set_player_input(move_x, move_y)

                elif msg_type == "trigger_pulse":
                    await sim_session.trigger_pulse()

                elif msg_type == "control":
                    action = msg.get("action", "")
                    if action == "start":
                        await sim_session.start()
                    elif action == "pause":
                        await sim_session.pause()
                    elif action == "resume":
                        await sim_session.resume()
                    elif action == "reset":
                        await sim_session.reset()
                    elif action == "step":
                        await sim_session.step_once()
                    elif action == "spawn_npc":
                        ai_type = msg.get("ai_type", "fuzzy")
                        await sim_session.spawn_npc(ai_type)
                    elif action == "remove_npc":
                        ai_type = msg.get("ai_type")
                        await sim_session.remove_npc(ai_type=ai_type)
                    elif action == "damage_npc":
                        target_id = msg.get("id")
                        amount = float(msg.get("amount", 40.0))
                        await sim_session.damage_npc(id=target_id, amount=amount)
                    elif action == "damage_all":
                        amount = float(msg.get("amount", 45.0))
                        await sim_session.damage_npc(amount=amount)

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format."})
    except WebSocketDisconnect:
        sim_session.disconnect_client(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        sim_session.disconnect_client(websocket)
