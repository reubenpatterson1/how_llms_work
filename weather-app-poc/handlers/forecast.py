"""ForecastHandler — REST endpoints for forecast resource.

From build package:
- GET /api/forecast?city={name}&days=5 — multi-day forecast
- Depends on IAuthService (import, do not implement)

From dense spec:
- JSON responses
- Error codes 400/401/404/500/502
- Retry upstream OpenWeatherMap 3x exponential backoff
- In-memory cache 5min TTL
- Input sanitization max 100 chars
"""

import os
import time
import requests
from flask import Blueprint, request, jsonify
from auth import require_api_key

forecast_bp = Blueprint("forecast", __name__)

# ── OpenWeatherMap 5-day forecast ──
OWM_API_KEY = os.environ.get("OWM_API_KEY", "")
OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

# ── Cache: 5min TTL ──
_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 300


def _get_cached(key: str) -> dict | None:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: dict):
    _cache[key] = (data, time.time())


def _fetch_forecast(city_name: str, days: int) -> list[dict] | None:
    """Fetch forecast from OpenWeatherMap with 3x exponential backoff."""
    last_error = None
    for attempt in range(3):
        try:
            resp = requests.get(OWM_FORECAST_URL, params={
                "q": city_name,
                "appid": OWM_API_KEY,
                "units": "metric",
                "cnt": days * 8,  # OWM returns 3-hour intervals, 8 per day
            }, timeout=5)

            if resp.status_code == 404:
                return None
            resp.raise_for_status()

            data = resp.json()
            # Aggregate to daily highs/lows
            daily: dict[str, dict] = {}
            for item in data.get("list", []):
                dt_text = item["dt_txt"][:10]  # "2024-01-15"
                temp = item["main"]["temp"]
                desc = item["weather"][0]["description"] if item.get("weather") else ""

                if dt_text not in daily:
                    daily[dt_text] = {"date": dt_text, "high": temp, "low": temp, "description": desc}
                else:
                    daily[dt_text]["high"] = max(daily[dt_text]["high"], temp)
                    daily[dt_text]["low"] = min(daily[dt_text]["low"], temp)

            forecasts = sorted(daily.values(), key=lambda x: x["date"])[:days]
            return forecasts

        except requests.RequestException as e:
            last_error = e
            if attempt < 2:
                time.sleep(2 ** attempt)

    raise ConnectionError(f"OpenWeatherMap unavailable after 3 retries: {last_error}")


@forecast_bp.route("/api/forecast")
@require_api_key
def get_forecast():
    """GET /api/forecast?city={name}&days=5 — multi-day forecast."""
    city = request.args.get("city", "").strip()
    days_str = request.args.get("days", "5")

    # Input sanitization
    if not city:
        return jsonify({"status": "error", "message": "Missing 'city' parameter"}), 400
    if len(city) > 100:
        return jsonify({"status": "error", "message": "City name too long (max 100 chars)"}), 400

    try:
        days = int(days_str)
        if days < 1 or days > 5:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "'days' must be 1-5"}), 400

    # Cache check
    cache_key = f"forecast:{city.lower()}:{days}"
    cached = _get_cached(cache_key)
    if cached:
        return jsonify({"status": "ok", "data": cached, "cached": True})

    # Fetch upstream
    try:
        data = _fetch_forecast(city, days)
    except ConnectionError:
        return jsonify({"status": "error", "message": "Weather service unavailable"}), 502

    if data is None:
        return jsonify({"status": "error", "message": f"City '{city}' not found"}), 404

    _set_cache(cache_key, data)
    return jsonify({"status": "ok", "data": data, "cached": False})
