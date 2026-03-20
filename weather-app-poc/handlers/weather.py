"""WeatherHandler — REST endpoints for weather resource.

From build package:
- GET /api/weather?city={name} — current conditions
- Depends on IAuthService (import, do not implement)

From dense spec:
- JSON responses
- Error codes 400/401/404/500/502
- Retry upstream OpenWeatherMap 3x exponential backoff
- In-memory cache 5min TTL
- P95 under 200ms cached
- Input sanitization max 100 chars
"""

import os
import time
import requests
from flask import Blueprint, request, jsonify
from auth import require_api_key

weather_bp = Blueprint("weather", __name__)

# ── OpenWeatherMap upstream ──
OWM_API_KEY = os.environ.get("OWM_API_KEY", "")
OWM_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

# ── In-memory cache: 5min TTL per spec ──
_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 300  # 5 minutes


def _get_cached(key: str) -> dict | None:
    """Return cached data if within TTL, else None."""
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: dict):
    _cache[key] = (data, time.time())


def _fetch_from_owm(city_name: str) -> dict:
    """Fetch current weather from OpenWeatherMap with 3x exponential backoff.

    Retry strategy from spec: 3 retries, exponential backoff.
    Error codes: 502 for upstream failures.
    """
    last_error = None
    for attempt in range(3):
        try:
            resp = requests.get(OWM_BASE_URL, params={
                "q": city_name,
                "appid": OWM_API_KEY,
                "units": "metric",
            }, timeout=5)

            if resp.status_code == 404:
                return None  # City not found
            resp.raise_for_status()

            data = resp.json()
            return {
                "city": data.get("name", city_name),
                "country": data.get("sys", {}).get("country", ""),
                "temp": data.get("main", {}).get("temp"),
                "humidity": data.get("main", {}).get("humidity"),
                "wind_speed": data.get("wind", {}).get("speed"),
                "description": data.get("weather", [{}])[0].get("description", ""),
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        except requests.RequestException as e:
            last_error = e
            if attempt < 2:
                time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s

    raise ConnectionError(f"OpenWeatherMap unavailable after 3 retries: {last_error}")


@weather_bp.route("/api/weather")
@require_api_key
def get_weather():
    """GET /api/weather?city={name} — current conditions for a city."""
    city = request.args.get("city", "").strip()

    # Input sanitization: max 100 chars per spec
    if not city:
        return jsonify({"status": "error", "message": "Missing 'city' parameter"}), 400
    if len(city) > 100:
        return jsonify({"status": "error", "message": "City name too long (max 100 chars)"}), 400

    # Check cache first (P95 < 200ms for cached per spec)
    cache_key = f"weather:{city.lower()}"
    cached = _get_cached(cache_key)
    if cached:
        return jsonify({"status": "ok", "data": cached, "cached": True})

    # Fetch from upstream
    try:
        data = _fetch_from_owm(city)
    except ConnectionError:
        return jsonify({"status": "error", "message": "Weather service unavailable"}), 502

    if data is None:
        return jsonify({"status": "error", "message": f"City '{city}' not found"}), 404

    _set_cache(cache_key, data)
    return jsonify({"status": "ok", "data": data, "cached": False})
