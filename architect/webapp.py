"""Flask web application for the Architecture Agent.

Production-level dashboard with:
- Real-time channel resolution visualization
- Chat-based intake interface
- Multi-provider LLM analysis (Ollama, OpenAI, Anthropic) with regex fallback
- Dense specification generation and export
- Vague vs Dense comparison view
- Provider settings configuration
"""

import json
import os
import time
from flask import Flask, render_template, request, jsonify, session, Response
from flask_socketio import SocketIO, emit

from .channels import ChannelRegistry
from .intake import IntakeEngine
from .spec_generator import SpecGenerator
from .llm_judge import (
    LLMJudge, ProviderConfig, ProviderType,
    PROVIDER_DEFAULTS, AVAILABLE_MODELS,
)
from .comparator import Comparator
from .mock_llm import MockLLM

app = Flask(__name__,
            template_folder=os.path.join(os.path.dirname(__file__), "templates"),
            static_folder=os.path.join(os.path.dirname(__file__), "static"))
app.secret_key = os.environ.get("FLASK_SECRET", "arch-agent-dev-key-change-in-prod")
socketio = SocketIO(app, cors_allowed_origins="*")

# ── Global provider config (shared across sessions) ──
_global_config: ProviderConfig = ProviderConfig(
    type=ProviderType.OLLAMA,
    model="llama3.2",
    base_url="http://localhost:11434",
    temperature=0.1,
    max_tokens=2048,
    timeout=120,
)

# ── Session state management ──
_sessions: dict[str, dict] = {}


def _get_state(sid: str) -> dict:
    """Get or create session state."""
    if sid not in _sessions:
        registry = ChannelRegistry()
        engine = IntakeEngine(registry)
        engine.set_llm_config(_global_config)
        judge = LLMJudge(registry, config=_global_config)
        _sessions[sid] = {
            "registry": registry,
            "engine": engine,
            "judge": judge,
            "history": [],
            "created": time.time(),
        }
    return _sessions[sid]


def _reset_state(sid: str):
    """Reset session state for a fresh intake."""
    if sid in _sessions:
        del _sessions[sid]


def _update_all_judges():
    """Push the global config to all active session judges and engines."""
    for sid, state in _sessions.items():
        state["judge"].set_config(_global_config)
        state["engine"].set_llm_config(_global_config)


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


@app.route("/settings")
def settings_page():
    return render_template("settings.html")


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

    provider = judge.active_provider
    model = judge.active_model
    available = judge.provider_available

    if provider == "regex":
        method_label = "Regex patterns"
    elif available:
        method_label = f"{model}"
    else:
        method_label = f"{provider} (offline)"

    return jsonify({
        "density_score": round(registry.overall_density_score(), 3),
        "channels": channels,
        "history_length": len(state["history"]),
        "provider": provider,
        "model": model,
        "provider_available": available,
        "analysis_method": method_label,
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

    # Feed response into engine's context for contextual question generation
    engine._app_description += " " + user_response

    # Get next question (uses LLM for context-aware questions when available)
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


# ── Settings API ──

@app.route("/api/settings")
def api_settings():
    """Get current provider configuration."""
    global _global_config
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    judge = state["judge"]

    # Get provider status
    status = judge.check_provider()

    # Get Ollama models if applicable
    ollama_models = []
    if _global_config.type == ProviderType.OLLAMA or True:  # Always check for the UI
        ollama_models = judge.list_ollama_models()

    return jsonify({
        "config": _global_config.to_dict(),
        "provider_status": status,
        "ollama_models": ollama_models,
        "available_providers": [
            {
                "type": "ollama",
                "label": "Ollama (Local)",
                "description": "Run models locally via Ollama. Free, private, no API key needed.",
                "requires_key": False,
                "models": ollama_models or ["llama3.2", "mistral", "codellama"],
            },
            {
                "type": "openai",
                "label": "OpenAI",
                "description": "GPT-4o, GPT-4o-mini via OpenAI API. Requires API key.",
                "requires_key": True,
                "models": AVAILABLE_MODELS[ProviderType.OPENAI],
                "env_key": "OPENAI_API_KEY",
            },
            {
                "type": "anthropic",
                "label": "Anthropic",
                "description": "Claude Sonnet, Haiku via Anthropic API. Requires API key.",
                "requires_key": True,
                "models": AVAILABLE_MODELS[ProviderType.ANTHROPIC],
                "env_key": "ANTHROPIC_API_KEY",
            },
            {
                "type": "regex",
                "label": "Regex (Offline)",
                "description": "Pattern-based analysis. No LLM required. Always available.",
                "requires_key": False,
                "models": ["regex-patterns"],
            },
        ],
    })


@app.route("/api/settings", methods=["POST"])
def api_settings_update():
    """Update provider configuration."""
    global _global_config  # noqa: PLW0603
    data = request.get_json()

    provider_type = data.get("type", "ollama")
    model = data.get("model", "")
    api_key = data.get("api_key", "")
    base_url = data.get("base_url", "")
    temperature = float(data.get("temperature", 0.1))
    max_tokens = int(data.get("max_tokens", 2048))
    timeout = int(data.get("timeout", 120))

    # Build config
    try:
        ptype = ProviderType(provider_type)
    except ValueError:
        return jsonify({"error": f"Unknown provider type: {provider_type}"}), 400

    # Use defaults for base_url if not provided
    if not base_url:
        default = PROVIDER_DEFAULTS.get(ptype)
        base_url = default.base_url if default else ""

    # Preserve existing key if masked or empty; fall back to env var
    if not api_key or api_key == "***":
        # Keep the current key if same provider type
        if _global_config.type == ptype and _global_config.api_key:
            api_key = _global_config.api_key
        elif ptype == ProviderType.OPENAI:
            api_key = os.environ.get("OPENAI_API_KEY", "")
        elif ptype == ProviderType.ANTHROPIC:
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    new_config = ProviderConfig(
        type=ptype,
        model=model or (PROVIDER_DEFAULTS[ptype].model if ptype in PROVIDER_DEFAULTS else ""),
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout=timeout,
    )

    _global_config = new_config
    _update_all_judges()

    # Check the new provider
    sid = data.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    status = state["judge"].check_provider()

    return jsonify({
        "config": new_config.to_dict(),
        "provider_status": status,
        "message": f"Provider updated to {ptype.value}:{new_config.model}",
    })


@app.route("/api/settings/test", methods=["POST"])
def api_settings_test():
    """Test the current provider with a sample message."""
    data = request.get_json() or {}
    sid = data.get("sid", session.get("sid", "default"))
    test_message = data.get("message", "TypeScript Express PostgreSQL Redis JWT RBAC")

    state = _get_state(sid)
    judge = state["judge"]

    start = time.time()
    updates, ambiguities, method = judge.analyze(test_message)
    elapsed = time.time() - start

    return jsonify({
        "method": method,
        "updates_count": len(updates),
        "ambiguities_count": len(ambiguities),
        "elapsed_seconds": round(elapsed, 2),
        "updates": [{
            "channel": u.channel_id,
            "sub": u.sub_dimension,
            "resolution": round(u.resolution, 3),
            "constraint": u.constraint,
        } for u in updates[:10]],  # Cap at 10 for display
        "success": len(updates) > 0,
    })


# ── Legacy compatibility ──

@app.route("/api/ollama/status")
def api_ollama_status():
    """Check provider availability (legacy endpoint, now provider-agnostic)."""
    sid = request.args.get("sid", session.get("sid", "default"))
    state = _get_state(sid)
    judge = state["judge"]
    status = judge.check_provider()

    return jsonify({
        "available": status.get("available", False),
        "provider": judge.active_provider,
        "model": judge.active_model,
        "analysis_log": judge.analysis_log,
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
