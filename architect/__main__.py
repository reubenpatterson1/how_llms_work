"""Entry point for running the Architecture Agent web application.

Usage: python -m architect [--port PORT] [--host HOST]
"""
import eventlet
# socket=True fixes the Ollama-call freeze (a blocking requests.post() call
# stalls the whole eventlet worker without this). subprocess=False is
# deliberate: deployer.py's docker/kubectl subprocess calls are left
# unpatched to avoid known eventlet+subprocess deadlock/ECHILD issues.
eventlet.monkey_patch(socket=True, select=True, thread=True, time=True, os=True, subprocess=False)

import argparse
from .webapp import run

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Architecture Agent Web Application")
    parser.add_argument("--port", "-p", type=int, default=5001, help="Port to run on (default: 5001)")
    parser.add_argument("--host", "-H", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--no-debug", action="store_true", help="Disable debug mode")
    args = parser.parse_args()
    run(host=args.host, port=args.port, debug=not args.no_debug)
