"""Flask web application for the Architecture Agent.

Production-level dashboard with:
- Real-time channel resolution visualization
- Chat-based intake interface
- LLM-powered response analysis with regex fallback
- Dense specification generation and export
- Vague vs Dense comparison view
"""

import json
import os
import time
from flask import Flask, render_template, request, jsonify, session, Response
from flask_socketio import SocketIO, emit

from .channels import ChannelRegistry
from .intake import IntakeEngine
from .spec_generator import SpecGenerator
from .llm_judge import LLMJudge
from .comparator import Comparator
from .mock_llm import MockLLM

app = Flask(__name__,
            template_folder=os.path.join(os.path.dirname(__file__), "templates"),
            static_folder=os.path.join(os.path.dirname(__file__), "static"))
app.secret_key = os.environ.get("FLASK_SECRET", "arch-agent-dev-key-change-in-prod")
socketio = SocketIO(app, cors_allowed_origins="*")

# ── Session state management ──
# In production this would be Redis-backed; for local use, in-memory dict keyed by session ID
_sessions: dict[str, dict] = {}


def _get_state(sid: str) -> dict:
    """Get or create session state."""
    if sid not in _sessions:
        registry = ChannelRegistry()
        _sessions[sid] = {
            "registry": registry,
            "engine": IntakeEngine(registry),
            "judge": LLMJudge(registry),
            "history": [],
            "created": time.time(),
        }
    return _sessions[sid]


def _reset_state(sid: str):
    """Reset session state for a fresh intake."""
    if sid in _sessions:
        del _sessions[sid]


# ── Routes ──

@app.route("/")
def index():
    return render_template("dashboard.html")


@app.route("/intake")
def intake_page():
    return render_template("intake.html")


@app.route("/comparison")
def comparison_page():
    return render_template("comparison.html")


@app.route("/spec")
def spec_page():
    return render_template("spec.html")


# ── API endpoints ──

@app.route("/api/status")
def api_status():
    """Return current session status and channel resolutions."""
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    registry = state["registry"]
    judge = state["judge"]

    channels = {}
    for ch_id, ch in registry.channels.items():
        subs = {}
        for sub_id, sub in ch.sub_dimensions.items():
            subs[sub_id] = {
                "name": sub.name,
                "description": sub.description,
                "resolution": round(sub.resolution, 3),
                "constraints": sub.constraints,
            }
        channels[ch_id] = {
            "name": ch.name,
            "description": ch.description,
            "resolution": round(ch.resolution, 3),
            "sub_dimensions": subs,
            "constraints": ch.constraints,
        }

    return jsonify({
        "density_score": round(registry.overall_density_score(), 3),
        "channels": channels,
        "history_length": len(state["history"]),
        "ollama_available": judge.ollama_available,
        "analysis_method": "LLM (llama3.2)" if judge.ollama_available else "Regex patterns",
        "is_complete": state["engine"].is_complete(),
    })


@app.route("/api/send", methods=["POST"])
def api_send():
    """Process a user response through the LLM judge."""
    data = request.get_json()
    user_response = data.get("message", "").strip()
    sid = data.get("sid", session.get("sid", "default"))

    if not user_response:
        return jsonify({"error": "Empty message"}), 400

    state = _get_state(sid)
    registry = state["registry"]
    engine = state["engine"]
    judge = state["judge"]

    # Analyze with LLM judge (falls back to regex)
    updates, ambiguities, method = judge.analyze(user_response)

    # Apply updates to registry
    for u in updates:
        registry.update_resolution(u.channel_id, u.sub_dimension, u.resolution, u.constraint)

    # Get next question
    is_complete = engine.is_complete()
    next_q = None if is_complete else engine._next_question()

    # Build response
    update_list = [{
        "channel": u.channel_id,
        "sub": u.sub_dimension,
        "resolution": round(u.resolution, 3),
        "constraint": u.constraint,
    } for u in updates]

    ambiguity_list = [{
        "text": a.text,
        "channel": a.channel_id,
        "reason": a.reason,
    } for a in ambiguities]

    # Track history
    entry = {
        "role": "user",
        "message": user_response,
        "updates": update_list,
        "ambiguities": ambiguity_list,
        "method": method,
        "density_after": round(registry.overall_density_score(), 3),
        "timestamp": time.time(),
    }
    state["history"].append(entry)

    if next_q:
        state["history"].append({
            "role": "agent",
            "message": next_q,
            "timestamp": time.time(),
        })

    # Build channel summary for response
    channels_summary = {}
    for ch_id, ch in registry.channels.items():
        channels_summary[ch_id] = {
            "name": ch.name,
            "resolution": round(ch.resolution, 3),
        }

    return jsonify({
        "updates": update_list,
        "ambiguities": ambiguity_list,
        "method": method,
        "next_question": next_q,
        "is_complete": is_complete,
        "density_score": round(registry.overall_density_score(), 3),
        "channels": channels_summary,
    })


@app.route("/api/first-question")
def api_first_question():
    """Get the first intake question."""
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    q = state["engine"].first_question()
    state["history"].append({
        "role": "agent",
        "message": q,
        "timestamp": time.time(),
    })
    return jsonify({"question": q})


@app.route("/api/history")
def api_history():
    """Get conversation history."""
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    return jsonify({"history": state["history"]})


@app.route("/api/reset", methods=["POST"])
def api_reset():
    """Reset the intake session."""
    sid = request.get_json().get("sid", session.get("sid", "default"))
    _reset_state(sid)
    return jsonify({"status": "reset"})


@app.route("/api/spec")
def api_spec():
    """Generate and return the dense architecture specification."""
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    gen = SpecGenerator(state["registry"])
    return jsonify({
        "spec": gen.generate(),
        "density_score": round(gen.density_score(), 3),
        "unresolved": gen.unresolved_summary(),
    })


@app.route("/api/spec/download")
def api_spec_download():
    """Download spec as a text file."""
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    gen = SpecGenerator(state["registry"])
    spec_text = gen.generate()
    return Response(
        spec_text,
        mimetype="text/plain",
        headers={"Content-Disposition": "attachment; filename=architecture-spec.md"},
    )


@app.route("/api/compare", methods=["POST"])
def api_compare():
    """Run vague vs dense comparison."""
    data = request.get_json() or {}
    vague_prompt = data.get("vague_prompt", "Build me a task management API with real-time updates")
    sid = data.get("sid", session.get("sid", "default"))
    state = _get_state(sid)

    gen = SpecGenerator(state["registry"])
    dense_spec = gen.generate()

    comp = Comparator(MockLLM(), iterations=5)
    results = comp.run(vague_prompt, dense_spec)

    return jsonify(results)


@app.route("/api/ollama/status")
def api_ollama_status():
    """Check Ollama availability."""
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    available = state["judge"].refresh_ollama_status()
    return jsonify({
        "available": available,
        "model": "llama3.2" if available else None,
        "analysis_log": state["judge"].analysis_log,
    })


# ── WebSocket events ──

@socketio.on("connect")
def ws_connect():
    sid = request.sid
    emit("connected", {"sid": sid})


@socketio.on("send_message")
def ws_send_message(data):
    """Process message via WebSocket for real-time updates."""
    user_msg = data.get("message", "").strip()
    sid = data.get("sid", request.sid)

    if not user_msg:
        return

    state = _get_state(sid)
    registry = state["registry"]
    engine = state["engine"]
    judge = state["judge"]

    updates, ambiguities, method = judge.analyze(user_msg)

    for u in updates:
        registry.update_resolution(u.channel_id, u.sub_dimension, u.resolution, u.constraint)

    is_complete = engine.is_complete()
    next_q = None if is_complete else engine._next_question()

    update_list = [{
        "channel": u.channel_id,
        "sub": u.sub_dimension,
        "resolution": round(u.resolution, 3),
        "constraint": u.constraint,
    } for u in updates]

    # Emit real-time channel update
    channels_data = {}
    for ch_id, ch in registry.channels.items():
        channels_data[ch_id] = {
            "name": ch.name,
            "resolution": round(ch.resolution, 3),
        }

    emit("analysis_result", {
        "updates": update_list,
        "ambiguities": [{"text": a.text, "reason": a.reason} for a in ambiguities],
        "method": method,
        "next_question": next_q,
        "is_complete": is_complete,
        "density_score": round(registry.overall_density_score(), 3),
        "channels": channels_data,
    })


def run(host="0.0.0.0", port=5001, debug=True):
    """Run the Flask web application."""
    socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)


if __name__ == "__main__":
    run()
