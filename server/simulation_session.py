"""
Thread-safe, asynchronous session manager for the continuous 2D simulation engine.
Runs the simulation loop in an asyncio task, handles client input, and broadcasts
snapshots at the configured tick rate without blocking the main event loop.
"""
import asyncio
import logging
from typing import Set, Optional, Dict, Any, List
from fastapi import WebSocket

from simulation.simulation_engine import SimulationEngine
from simulation.entities import NPC, Player
from simulation.scenarios import get_experiment_scenario
from simulation.ai.factory import make_ai_engine

logger = logging.getLogger("simulation_session")

DEFAULT_AI_TYPES = ["fsm", "behavior_tree", "fuzzy", "goap", "utility"]
DEFAULT_COLORS = {
    "fsm": ("#ef4444", "#f87171"),
    "simple": ("#ef4444", "#f87171"),
    "behavior_tree": ("#10b981", "#34d399"),
    "fuzzy": ("#06b6d4", "#22d3ee"),
    "goap": ("#f59e0b", "#fbbf24"),
    "utility": ("#8b5cf6", "#a78bfa"),
}


class SimulationSessionManager:
    def __init__(self, width: float = 1000.0, height: float = 700.0):
        self.width = width
        self.height = height
        self.scenario_id = "open_arena"
        self.fps = 30
        self.dt = 1.0 / self.fps

        self.engine = SimulationEngine(width=self.width, height=self.height)
        self.is_running = False
        self.is_paused = False

        self._task: Optional[asyncio.Task] = None
        self._connected_clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

        # Player real-time controls from client input
        self.player_move_x = 0.0
        self.player_move_y = 0.0

        # Initialize with default scenario and NPCs
        self._load_scenario_internal(self.scenario_id)

    @property
    def client_count(self) -> int:
        return len(self._connected_clients)

    def _load_scenario_internal(
        self,
        scenario_id: str,
        custom_npcs: Optional[List[Dict[str, Any]]] = None
    ):
        self.scenario_id = scenario_id
        scenario = get_experiment_scenario(scenario_id, self.width, self.height)

        # Clear and load layout
        self.engine.crates = list(scenario.crates)
        self.engine.heal_stations = list(scenario.heal_stations)
        self.engine.tick_count = 0
        self.engine.survival_time = 0.0
        self.engine.is_game_over = False

        # Reset player
        self.engine.player.x = scenario.player_start_pos.x
        self.engine.player.y = scenario.player_start_pos.y
        self.engine.player.vx = 0.0
        self.engine.player.vy = 0.0
        self.engine.player.health = scenario.player_initial_health
        self.engine.player.max_health = 100.0
        self.engine.player.pulse_cooldown = 0.0
        self.player_move_x = 0.0
        self.player_move_y = 0.0

        # Clear and register NPCs
        self.engine.npcs.clear()
        self.engine.ai_controllers.clear()

        if custom_npcs:
            for npc_cfg in custom_npcs:
                ai_type = npc_cfg.get("ai_type") or "fuzzy"
                colors = DEFAULT_COLORS.get(ai_type, ("#06b6d4", "#22d3ee"))
                x_pos = npc_cfg.get("x")
                if x_pos is None:
                    x_pos = scenario.npc_start_pos.x
                y_pos = npc_cfg.get("y")
                if y_pos is None:
                    y_pos = scenario.npc_start_pos.y

                npc = NPC(
                    id=npc_cfg.get("id") or f"npc_{ai_type}",
                    ai_type=ai_type,
                    x=float(x_pos),
                    y=float(y_pos),
                    name=npc_cfg.get("name") or "",
                    color=npc_cfg.get("color") or colors[0],
                    accent_color=npc_cfg.get("accent_color") or colors[1],
                )
                npc.health = scenario.npc_initial_health
                controller = make_ai_engine(ai_type)
                self.engine.register_npc(npc, controller)
        else:
            # Default: create an NPC for the scenario's primary AI, or spawn all 5 if multi-agent
            # By default in open_arena, start with Fuzzy AI
            primary_ai = "fuzzy"
            colors = DEFAULT_COLORS.get(primary_ai, ("#06b6d4", "#22d3ee"))
            npc = NPC(
                id=f"npc_{primary_ai}",
                ai_type=primary_ai,
                x=scenario.npc_start_pos.x,
                y=scenario.npc_start_pos.y,
                name=f"{primary_ai.upper()} Agent",
                color=colors[0],
                accent_color=colors[1],
            )
            npc.health = scenario.npc_initial_health
            self.engine.register_npc(npc, make_ai_engine(primary_ai))

    async def configure(
        self,
        scenario_id: Optional[str] = None,
        width: Optional[float] = None,
        height: Optional[float] = None,
        custom_npcs: Optional[List[Dict[str, Any]]] = None,
        fps: Optional[int] = None
    ) -> dict:
        async with self._lock:
            if width is not None:
                self.width = width
                self.engine.width = width
            if height is not None:
                self.height = height
                self.engine.height = height
            if fps is not None and fps > 0:
                self.fps = fps
                self.dt = 1.0 / self.fps

            sc_id = scenario_id or self.scenario_id
            self._load_scenario_internal(sc_id, custom_npcs)
            snapshot = self.engine.get_state_snapshot()
            await self.broadcast(snapshot)
            return snapshot

    async def start(self):
        async with self._lock:
            if self.is_running:
                self.is_paused = False
                return {"status": "already_running"}

            self.is_running = True
            self.is_paused = False
            self._task = asyncio.create_task(self._simulation_loop())
            return {"status": "started"}

    async def pause(self):
        async with self._lock:
            self.is_paused = True
            self.engine.is_paused = True
            return {"status": "paused"}

    async def resume(self):
        async with self._lock:
            self.is_paused = False
            self.engine.is_paused = False
            return {"status": "resumed"}

    async def reset(self):
        async with self._lock:
            self._load_scenario_internal(self.scenario_id)
            snapshot = self.engine.get_state_snapshot()
            await self.broadcast(snapshot)
            return {"status": "reset", "snapshot": snapshot}

    async def step_once(self):
        async with self._lock:
            if not self.is_running or self.is_paused:
                self.engine.step(self.dt, self.player_move_x, self.player_move_y)
                snapshot = self.engine.get_state_snapshot()
                await self.broadcast(snapshot)
                return {"status": "stepped", "snapshot": snapshot}
            return {"status": "ignored", "reason": "simulation is running unpaused"}

    async def trigger_pulse(self):
        async with self._lock:
            hits = self.engine.trigger_player_pulse()
            snapshot = self.engine.get_state_snapshot()
            await self.broadcast(snapshot)
            return {"status": "pulse_triggered", "hits": hits}

    def set_player_input(self, move_x: float, move_y: float):
        self.player_move_x = max(-1.0, min(1.0, float(move_x)))
        self.player_move_y = max(-1.0, min(1.0, float(move_y)))

    async def spawn_npc(self, ai_type: str, custom_pos: Optional[Dict[str, float]] = None) -> dict:
        async with self._lock:
            import time
            import random
            from simulation.vector2 import Vector2
            colors = DEFAULT_COLORS.get(ai_type, ("#06b6d4", "#22d3ee"))
            id = f"npc_{ai_type}_{int(time.time()*1000) % 100000}"
            name = f"{ai_type.replace('_', ' ').title()} AI"
            if custom_pos:
                x = float(custom_pos.get("x", 200.0))
                y = float(custom_pos.get("y", 200.0))
            else:
                x = 80.0 + random.random() * (self.width - 160.0)
                y = 80.0 + random.random() * (self.height - 160.0)

            npc = NPC(
                id=id,
                ai_type=ai_type,
                x=x,
                y=y,
                name=name,
                color=colors[0],
                accent_color=colors[1],
            )
            controller = make_ai_engine(ai_type)
            self.engine.register_npc(npc, controller)
            snapshot = self.engine.get_state_snapshot()
            await self.broadcast(snapshot)
            return {"status": "spawned", "npc": npc.to_dict(), "snapshot": snapshot}

    async def remove_npc(self, id: Optional[str] = None, ai_type: Optional[str] = None) -> dict:
        async with self._lock:
            target_id = None
            if id:
                target_id = id
            elif ai_type:
                for n in reversed(self.engine.npcs):
                    if n.ai_type == ai_type:
                        target_id = n.id
                        break

            if target_id:
                self.engine.npcs = [n for n in self.engine.npcs if n.id != target_id]
                self.engine.ai_controllers.pop(target_id, None)

            snapshot = self.engine.get_state_snapshot()
            await self.broadcast(snapshot)
            return {"status": "removed", "target_id": target_id, "snapshot": snapshot}

    async def damage_npc(self, id: Optional[str] = None, amount: float = 40.0) -> dict:
        async with self._lock:
            if id:
                for n in self.engine.npcs:
                    if n.id == id:
                        n.health = max(1.0, n.health - amount)
                        n.last_damage_time = self.engine.survival_time
            else:
                for n in self.engine.npcs:
                    n.health = max(1.0, n.health - amount)
                    n.last_damage_time = self.engine.survival_time

            snapshot = self.engine.get_state_snapshot()
            await self.broadcast(snapshot)
            return {"status": "damaged", "snapshot": snapshot}

    async def stop(self):
        async with self._lock:
            self.is_running = False
            if self._task and not self._task.done():
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
            self._task = None
            return {"status": "stopped"}

    async def connect_client(self, websocket: WebSocket):
        await websocket.accept()
        self._connected_clients.add(websocket)
        # Send initial state snapshot immediately
        await websocket.send_json({
            "type": "state_update",
            "data": self.engine.get_state_snapshot()
        })

    def disconnect_client(self, websocket: WebSocket):
        self._connected_clients.discard(websocket)

    async def broadcast(self, data: dict):
        if not self._connected_clients:
            return

        message = {"type": "state_update", "data": data}
        dead_clients = set()
        for client in self._connected_clients:
            try:
                await client.send_json(message)
            except Exception:
                dead_clients.add(client)

        for client in dead_clients:
            self._connected_clients.discard(client)

    async def _simulation_loop(self):
        try:
            while self.is_running:
                start_time = asyncio.get_event_loop().time()

                if not self.is_paused and not self.engine.is_game_over:
                    # Advance simulation
                    self.engine.step(self.dt, self.player_move_x, self.player_move_y)
                    snapshot = self.engine.get_state_snapshot()
                    await self.broadcast(snapshot)

                elapsed = asyncio.get_event_loop().time() - start_time
                sleep_time = max(0.001, self.dt - elapsed)
                await asyncio.sleep(sleep_time)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.exception(f"Unexpected error in simulation loop: {e}")
            self.is_running = False
