"""Tests for Hello World Weather App.

From dense spec:
- pytest
- 70% coverage target
- mock weather API
- Fixture cities: London, Tokyo, New York
"""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
import requests

# Use a temp file DB so all connections share state (SQLite :memory: is per-connection)
import tempfile
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["WEATHER_DB"] = _test_db.name
_test_db.close()

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import app
from models import init_db


@pytest.fixture(autouse=True)
def clear_caches():
    """Clear in-memory caches between tests."""
    from handlers.weather import _cache as weather_cache
    from handlers.forecast import _cache as forecast_cache
    weather_cache.clear()
    forecast_cache.clear()
    yield
    weather_cache.clear()
    forecast_cache.clear()


@pytest.fixture
def client():
    """Flask test client with in-memory DB."""
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def api_key():
    return "demo-key-001"


@pytest.fixture
def headers(api_key):
    return {"X-API-Key": api_key}


# ── Health check ──

class TestHealth:
    def test_health_endpoint(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
        assert data["app"] == "Hello World Weather"


# ── Auth tests ──

class TestAuth:
    def test_missing_api_key_returns_401(self, client):
        resp = client.get("/api/weather?city=London")
        assert resp.status_code == 401
        assert "Missing" in resp.get_json()["message"]

    def test_invalid_api_key_returns_401(self, client):
        resp = client.get("/api/weather?city=London",
                          headers={"X-API-Key": "bad-key"})
        assert resp.status_code == 401
        assert "Invalid" in resp.get_json()["message"]

    def test_valid_api_key_passes(self, client, headers):
        # Will fail upstream (no OWM key) but should get past auth
        resp = client.get("/api/weather?city=London", headers=headers)
        assert resp.status_code != 401

    def test_api_key_too_long_returns_400(self, client):
        resp = client.get("/api/weather?city=London",
                          headers={"X-API-Key": "x" * 101})
        assert resp.status_code == 400
        assert "too long" in resp.get_json()["message"]


# ── Input validation tests ──

class TestInputValidation:
    def test_missing_city_param_returns_400(self, client, headers):
        resp = client.get("/api/weather", headers=headers)
        assert resp.status_code == 400

    def test_city_too_long_returns_400(self, client, headers):
        resp = client.get(f"/api/weather?city={'x' * 101}", headers=headers)
        assert resp.status_code == 400
        assert "too long" in resp.get_json()["message"]

    def test_empty_city_returns_400(self, client, headers):
        resp = client.get("/api/weather?city=", headers=headers)
        assert resp.status_code == 400

    def test_forecast_invalid_days_returns_400(self, client, headers):
        resp = client.get("/api/forecast?city=London&days=10", headers=headers)
        assert resp.status_code == 400

    def test_cities_missing_query_returns_400(self, client, headers):
        resp = client.get("/api/cities", headers=headers)
        assert resp.status_code == 400


# ── City search tests (uses seeded SQLite data) ──

class TestCitySearch:
    def test_search_returns_results(self, client, headers):
        resp = client.get("/api/cities?q=Lon", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
        assert len(data["data"]) >= 1
        assert data["data"][0]["name"] == "London"

    def test_search_tokyo(self, client, headers):
        resp = client.get("/api/cities?q=Tokyo", headers=headers)
        data = resp.get_json()
        assert any(c["name"] == "Tokyo" for c in data["data"])

    def test_search_new_york(self, client, headers):
        resp = client.get("/api/cities?q=New", headers=headers)
        data = resp.get_json()
        assert any(c["name"] == "New York" for c in data["data"])

    def test_search_no_match(self, client, headers):
        resp = client.get("/api/cities?q=Zzzznotacity", headers=headers)
        data = resp.get_json()
        assert data["status"] == "ok"
        assert len(data["data"]) == 0


# ── Weather endpoint with mocked upstream ──

class TestWeatherHandler:
    MOCK_OWM_RESPONSE = {
        "name": "London",
        "sys": {"country": "GB"},
        "main": {"temp": 12.5, "humidity": 72},
        "wind": {"speed": 5.1},
        "weather": [{"description": "overcast clouds"}],
    }

    @patch("handlers.weather.requests.get")
    def test_get_weather_success(self, mock_get, client, headers):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = self.MOCK_OWM_RESPONSE
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/weather?city=London", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
        assert data["data"]["temp"] == 12.5
        assert data["data"]["humidity"] == 72
        assert data["data"]["wind_speed"] == 5.1
        assert data["data"]["city"] == "London"
        assert data["cached"] is False

    @patch("handlers.weather.requests.get")
    def test_weather_caching(self, mock_get, client, headers):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = self.MOCK_OWM_RESPONSE
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        # First request — cache miss
        resp1 = client.get("/api/weather?city=London", headers=headers)
        assert resp1.get_json()["cached"] is False

        # Second request — cache hit
        resp2 = client.get("/api/weather?city=London", headers=headers)
        assert resp2.get_json()["cached"] is True
        assert mock_get.call_count == 1  # Only called once

    @patch("handlers.weather.requests.get")
    def test_city_not_found_returns_404(self, mock_get, client, headers):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp

        resp = client.get("/api/weather?city=Fakecity", headers=headers)
        assert resp.status_code == 404

    @patch("handlers.weather.requests.get")
    def test_upstream_failure_returns_502(self, mock_get, client, headers):
        mock_get.side_effect = requests.RequestException("Connection refused")

        resp = client.get("/api/weather?city=London", headers=headers)
        assert resp.status_code == 502


# ── Forecast endpoint with mocked upstream ──

class TestForecastHandler:
    MOCK_FORECAST = {
        "list": [
            {"dt_txt": "2024-01-15 12:00:00", "main": {"temp": 10},
             "weather": [{"description": "clear sky"}]},
            {"dt_txt": "2024-01-15 15:00:00", "main": {"temp": 14},
             "weather": [{"description": "clear sky"}]},
            {"dt_txt": "2024-01-16 12:00:00", "main": {"temp": 8},
             "weather": [{"description": "light rain"}]},
        ]
    }

    @patch("handlers.forecast.requests.get")
    def test_get_forecast_success(self, mock_get, client, headers):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = self.MOCK_FORECAST
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/forecast?city=London&days=2", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"
        assert len(data["data"]) == 2
        # Day 1: high=14, low=10
        assert data["data"][0]["high"] == 14
        assert data["data"][0]["low"] == 10
        assert data["data"][0]["date"] == "2024-01-15"

    @patch("handlers.forecast.requests.get")
    def test_forecast_default_5_days(self, mock_get, client, headers):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = self.MOCK_FORECAST
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        resp = client.get("/api/forecast?city=London", headers=headers)
        assert resp.status_code == 200


# ── CORS test ──

class TestCORS:
    def test_cors_headers_present(self, client):
        resp = client.get("/")
        assert resp.headers.get("Access-Control-Allow-Origin") == "*"
