"""Hello World Weather App — Flask entry point.

From dense spec:
- Python 3.12, Flask 3.0, SQLite
- CORS allow-all
- Error codes 400/401/404/500/502
- Structured JSON responses: {status, data/message}
"""

import os
from flask import Flask, jsonify
from models import init_db
from handlers.weather import weather_bp
from handlers.forecast import forecast_bp
from handlers.city import city_bp, init_cities

app = Flask(__name__)

# CORS allow-all per spec
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-API-Key"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return response

# Register blueprints — one per resource per decomposition
app.register_blueprint(weather_bp)
app.register_blueprint(forecast_bp)
app.register_blueprint(city_bp)


# ── Error handlers per spec taxonomy ──

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"status": "error", "message": str(e)}), 400

@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"status": "error", "message": "Unauthorized"}), 401

@app.errorhandler(404)
def not_found(e):
    return jsonify({"status": "error", "message": "Not found"}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"status": "error", "message": "Internal server error"}), 500


@app.route("/")
def health():
    return jsonify({"status": "ok", "app": "Hello World Weather", "version": "poc"})


# ── Startup ──

def setup():
    """Initialize DB and seed data. Safe to call multiple times."""
    conn = init_db()
    from handlers.city import _seed_cities
    _seed_cities(conn)
    conn.close()

setup()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5002))
    app.run(host="0.0.0.0", port=port, debug=True)
