"""
Background task runner and state manager for benchmark evaluations.
Runs benchmark experiments off the FastAPI main event loop using asyncio.to_thread,
broadcasts progress events, and caches results for retrieval and CSV exports.
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List

from benchmark.runner import BenchmarkRunner

logger = logging.getLogger("benchmark_session")


class BenchmarkSessionManager:
    def __init__(self, width: float = 1000.0, height: float = 700.0):
        self.width = width
        self.height = height
        self.runner = BenchmarkRunner(width=self.width, height=self.height)

        self.is_running = False
        self.current_progress: Dict[str, Any] = {
            "completed": 0,
            "total": 0,
            "current": "",
            "percent": 0.0,
        }
        self.last_result: Optional[Dict[str, Any]] = None
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def start_benchmark(
        self,
        scenario_id: str = "open_arena",
        trials_per_ai: int = 5,
        ai_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        async with self._lock:
            if self.is_running:
                return {
                    "status": "already_running",
                    "progress": self.current_progress
                }

            self.is_running = True
            self.runner._cancel_requested = False
            self.last_result = None
            total_ai = len(ai_types) if ai_types else 5
            self.current_progress = {
                "completed": 0,
                "total": total_ai * trials_per_ai,
                "current": "Starting benchmark...",
                "percent": 0.0,
            }

            self._task = asyncio.create_task(
                self._run_benchmark_worker(scenario_id, trials_per_ai, ai_types)
            )

            return {
                "status": "started",
                "scenario_id": scenario_id,
                "trials_per_ai": trials_per_ai,
                "total_trials": self.current_progress["total"]
            }

    async def cancel_benchmark(self) -> Dict[str, Any]:
        async with self._lock:
            if not self.is_running:
                return {"status": "not_running"}

            self.runner.cancel()
            self.is_running = False
            return {"status": "cancelling"}

    def get_status(self) -> Dict[str, Any]:
        return {
            "isRunning": self.is_running,
            "progress": self.current_progress,
            "hasResult": self.last_result is not None,
            "experimentId": self.last_result.get("experimentId") if self.last_result else None
        }

    def get_results(self) -> Optional[Dict[str, Any]]:
        return self.last_result

    def get_csv_trials(self) -> Optional[str]:
        if self.last_result:
            return self.last_result.get("csvTrials")
        return None

    def get_csv_aggregates(self) -> Optional[str]:
        if self.last_result:
            return self.last_result.get("csvAggregates")
        return None

    async def _run_benchmark_worker(
        self,
        scenario_id: str,
        trials_per_ai: int,
        ai_types: Optional[List[str]]
    ):
        def progress_callback(completed: int, total: int, current_desc: str):
            pct = round((completed / total) * 100.0, 1) if total > 0 else 0.0
            self.current_progress = {
                "completed": completed,
                "total": total,
                "current": current_desc,
                "percent": pct,
            }

        try:
            # Execute synchronously in thread pool so it never blocks the async event loop
            results = await asyncio.to_thread(
                self.runner.run_experiment,
                scenario_id=scenario_id,
                trials_per_ai=trials_per_ai,
                ai_types=ai_types,
                on_progress=progress_callback
            )

            self.last_result = results
            self.current_progress = {
                "completed": results["completedTrials"],
                "total": results["totalTrials"],
                "current": "Benchmark complete!",
                "percent": 100.0,
            }
        except Exception as e:
            logger.exception(f"Error during benchmark execution: {e}")
            self.current_progress["current"] = f"Error: {str(e)}"
        finally:
            self.is_running = False
