"""
Sentinel Full-Stack Launcher — starts FastAPI backend & React frontend concurrently.

Usage:
  python scripts/start_all.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import webbrowser

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")


def main():
    print("=" * 60)
    print("🛡️  STARTING SENTINEL AUTONOMOUS INCIDENT COMMANDER")
    print("=" * 60)
    print(f"📁 Root: {ROOT_DIR}")
    print(f"💻 Frontend: {FRONTEND_DIR}\n")

    # 1. Start Backend Server
    print("🚀 [1/2] Launching FastAPI Backend on http://localhost:8000 ...", flush=True)
    backend_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload",
    ]
    backend_proc = subprocess.Popen(backend_cmd, cwd=ROOT_DIR)

    # Allow backend to initialize database & lifespan
    time.sleep(2.0)

    # 2. Start Frontend Server
    print("💻 [2/2] Launching React Dashboard on http://localhost:5173 ...", flush=True)
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=FRONTEND_DIR)

    time.sleep(1.5)

    print("\n" + "=" * 60)
    print("✅ SENTINEL IS LIVE & OPERATIONAL!")
    print("   • Backend API & Docs: http://localhost:8000/docs")
    print("   • Live Instrument UI: http://localhost:5173")
    print("   • WebSocket Stream:   ws://localhost:8000/ws/incidents")
    print("=" * 60)
    print("💡 Press Ctrl+C to stop both servers safely.\n")

    # Open dashboard in browser
    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    try:
        while True:
            time.sleep(1.0)
            if backend_proc.poll() is not None:
                print("❌ Backend process exited unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("❌ Frontend process exited unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n🛑 Shutting down Sentinel servers...")
    finally:
        backend_proc.terminate()
        frontend_proc.terminate()
        print("✅ Shutdown complete.")


if __name__ == "__main__":
    main()
