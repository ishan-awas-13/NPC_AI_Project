"""
Automated integration tests for FastAPI REST endpoints and WebSocket streaming.
Validates:
1. Scenario and AI metadata endpoints
2. Simulation configuration, starting, pausing, stepping, and stopping
3. Player input and pulse attacks
4. Headless accelerated benchmark execution and status polling
5. Results retrieval and CSV downloads
6. WebSocket connection, live state broadcast, and bidirectional message handling
7. Error conditions and invalid requests
"""
import unittest
import asyncio
from fastapi.testclient import TestClient

from server.app import app, sim_session, benchmark_session


class TestServerAPI(unittest.TestCase):
    def setUp(self):
        self._client_ctx = TestClient(app)
        self.client = self._client_ctx.__enter__()

    def tearDown(self):
        self._client_ctx.__exit__(None, None, None)

    def test_status_endpoint(self):
        response = self.client.get("/api/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("simulation_running", data)
        self.assertIn("benchmark_running", data)
        self.assertIn("connected_clients", data)

    def test_scenarios_endpoint(self):
        response = self.client.get("/api/scenarios")
        self.assertEqual(response.status_code, 200)
        scenarios = response.json()
        self.assertEqual(len(scenarios), 5)
        sc_ids = [s["id"] for s in scenarios]
        self.assertIn("open_arena", sc_ids)
        self.assertIn("corridors", sc_ids)
        self.assertIn("low_health", sc_ids)
        self.assertIn("obstacle_arena", sc_ids)
        self.assertIn("dynamic_crossfire", sc_ids)

    def test_ai_types_endpoint(self):
        response = self.client.get("/api/ai-types")
        self.assertEqual(response.status_code, 200)
        ai_types = response.json()
        ids = [a["id"] for a in ai_types]
        self.assertIn("fsm", ids)
        self.assertIn("behavior_tree", ids)
        self.assertIn("fuzzy", ids)
        self.assertIn("goap", ids)
        self.assertIn("utility", ids)

    def test_simulation_configure(self):
        payload = {
            "scenario_id": "corridors",
            "width": 1000.0,
            "height": 700.0,
            "npcs": [
                {"id": "npc_fsm", "ai_type": "fsm"},
                {"id": "npc_bt", "ai_type": "behavior_tree"}
            ],
            "fps": 30
        }
        response = self.client.post("/api/simulation/configure", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "configured")
        snapshot = data["snapshot"]
        self.assertEqual(len(snapshot["npcs"]), 2)
        self.assertGreater(len(snapshot["crates"]), 0)

    def test_simulation_control_lifecycle(self):
        # Configure open arena
        self.client.post("/api/simulation/configure", json={"scenario_id": "open_arena"})

        # Start
        resp = self.client.post("/api/simulation/control", json={"action": "start"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn(resp.json()["status"], ["started", "already_running"])

        # Pause
        resp = self.client.post("/api/simulation/control", json={"action": "pause"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "paused")

        # Step once while paused
        resp = self.client.post("/api/simulation/control", json={"action": "step"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "stepped")

        # Trigger pulse
        resp = self.client.post("/api/simulation/control", json={"action": "trigger_pulse"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "pulse_triggered")

        # Resume
        resp = self.client.post("/api/simulation/control", json={"action": "resume"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "resumed")

        # Reset
        resp = self.client.post("/api/simulation/control", json={"action": "reset"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "reset")

        # Stop
        resp = self.client.post("/api/simulation/control", json={"action": "stop"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "stopped")

    def test_simulation_player_move(self):
        resp = self.client.post("/api/simulation/player-move", json={"move_x": 0.5, "move_y": -0.8})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(sim_session.player_move_x, 0.5)
        self.assertEqual(sim_session.player_move_y, -0.8)

    def test_simulation_snapshot(self):
        resp = self.client.get("/api/simulation/snapshot")
        self.assertEqual(resp.status_code, 200)
        snapshot = resp.json()
        self.assertIn("player", snapshot)
        self.assertIn("npcs", snapshot)
        self.assertIn("crates", snapshot)
        self.assertIn("healStations", snapshot)
        self.assertIn("tick", snapshot)

    def test_invalid_control_action(self):
        resp = self.client.post("/api/simulation/control", json={"action": "invalid_action_xyz"})
        self.assertEqual(resp.status_code, 400)

    def test_benchmark_start_and_csv_export(self):
        # Start a quick 1-trial benchmark for FSM
        start_payload = {
            "scenario_id": "open_arena",
            "trials_per_ai": 1,
            "ai_types": ["fsm"]
        }
        resp = self.client.post("/api/benchmark/start", json=start_payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "started")

        # Poll status until done
        import time
        max_wait = 10.0
        start_t = time.time()
        while time.time() - start_t < max_wait:
            status_resp = self.client.get("/api/benchmark/status")
            self.assertEqual(status_resp.status_code, 200)
            status_data = status_resp.json()
            if not status_data["isRunning"] and status_data["hasResult"]:
                break
            time.sleep(0.1)

        # Verify results endpoint
        results_resp = self.client.get("/api/benchmark/results")
        self.assertEqual(results_resp.status_code, 200)
        results = results_resp.json()
        self.assertEqual(len(results["results"]), 1)
        self.assertIn("aggregates", results)
        self.assertIn("fsm", results["aggregates"])

        # Test CSV export endpoints
        trials_csv = self.client.get("/api/benchmark/export/trials.csv")
        self.assertEqual(trials_csv.status_code, 200)
        self.assertIn("text/csv", trials_csv.headers["content-type"])
        self.assertIn("experiment_id,trial,ai_system,map", trials_csv.text)

        agg_csv = self.client.get("/api/benchmark/export/aggregates.csv")
        self.assertEqual(agg_csv.status_code, 200)
        self.assertIn("text/csv", agg_csv.headers["content-type"])
        self.assertIn("ai_system,trial_count,win_rate_percent", agg_csv.text)

    def test_websocket_streaming_and_controls(self):
        with self.client.websocket_connect("/ws/simulation") as websocket:
            # First message should be initial state snapshot
            initial_msg = websocket.receive_json()
            self.assertEqual(initial_msg["type"], "state_update")
            self.assertIn("player", initial_msg["data"])

            # Send ping
            websocket.send_json({"type": "ping"})
            pong_msg = websocket.receive_json()
            self.assertEqual(pong_msg["type"], "pong")

            # Send player input over WebSocket
            websocket.send_json({"type": "player_input", "move_x": 0.3, "move_y": -0.6})
            self.assertEqual(sim_session.player_move_x, 0.3)
            self.assertEqual(sim_session.player_move_y, -0.6)

            # Send control action over WebSocket
            websocket.send_json({"type": "control", "action": "step"})
            step_update = websocket.receive_json()
            self.assertEqual(step_update["type"], "state_update")


if __name__ == "__main__":
    unittest.main()
