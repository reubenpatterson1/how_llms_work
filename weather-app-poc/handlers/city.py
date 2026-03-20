"""CityHandler — REST endpoints for city resource.

From build package:
- GET /api/cities?q={query} — city search autocomplete
- Depends on IAuthService (import, do not implement)

From dense spec:
- JSON responses
- SQLite with index on City.name
- Input sanitization max 100 chars
"""

import sqlite3
from flask import Blueprint, request, jsonify
from auth import require_api_key
from models import City, init_db, DB_PATH

city_bp = Blueprint("city", __name__)


def _get_db() -> sqlite3.Connection:
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _seed_cities(conn: sqlite3.Connection):
    """Seed with common cities if table is empty (PoC convenience)."""
    cursor = conn.execute("SELECT COUNT(*) FROM cities")
    if cursor.fetchone()[0] == 0:
        cities = [
            ("London", "GB"), ("Tokyo", "JP"), ("New York", "US"),
            ("Paris", "FR"), ("Berlin", "DE"), ("Sydney", "AU"),
            ("Mumbai", "IN"), ("São Paulo", "BR"), ("Cairo", "EG"),
            ("Toronto", "CA"), ("Mexico City", "MX"), ("Lagos", "NG"),
            ("Seoul", "KR"), ("Beijing", "CN"), ("Moscow", "RU"),
        ]
        conn.executemany(
            "INSERT INTO cities (name, country_code) VALUES (?, ?)", cities
        )
        conn.commit()


@city_bp.route("/api/cities")
@require_api_key
def search_cities():
    """GET /api/cities?q={query} — city search autocomplete."""
    query = request.args.get("q", "").strip()

    # Input sanitization: max 100 chars per spec
    if not query:
        return jsonify({"status": "error", "message": "Missing 'q' parameter"}), 400
    if len(query) > 100:
        return jsonify({"status": "error", "message": "Query too long (max 100 chars)"}), 400

    conn = _get_db()
    try:
        # Uses idx_cities_name index for performance
        cursor = conn.execute(
            "SELECT id, name, country_code FROM cities WHERE name LIKE ? LIMIT 10",
            (f"%{query}%",),
        )
        results = [
            City(id=row["id"], name=row["name"], country_code=row["country_code"]).to_dict()
            for row in cursor.fetchall()
        ]
    finally:
        conn.close()

    return jsonify({"status": "ok", "data": results})


def init_cities():
    """Initialize cities table with seed data."""
    conn = _get_db()
    try:
        _seed_cities(conn)
    finally:
        conn.close()
