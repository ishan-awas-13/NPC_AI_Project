#!/usr/bin/env python3
"""
CLI entry point to launch the FastAPI and WebSocket backend server.
Example usage:
    python run_server.py --port 8000 --host 0.0.0.0 --reload
"""
import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(description="NPC AI Simulation & Benchmark API Server")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload on code change")

    args = parser.parse_args()

    print(f"============================================================")
    print(f" NPC AI Simulation & Benchmark Server")
    print(f" Listening on http://{args.host}:{args.port}")
    print(f" REST API Docs: http://{args.host}:{args.port}/docs")
    print(f" WebSocket Stream: ws://{args.host}:{args.port}/ws/simulation")
    print(f"============================================================")

    uvicorn.run("server.app:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
