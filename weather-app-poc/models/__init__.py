"""Data models for the Hello World Weather App.

Entities from dense spec:
- City (name NOT NULL, country_code)
- WeatherData (city_id FK, temp, humidity, wind_speed, fetched_at)
- Forecast (city_id FK, date, high, low, description)

Relationships: City has-many WeatherData, City has-many Forecast
Index: City.name for search queries
"""

import sqlite3
import os
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional


DB_PATH = os.environ.get("WEATHER_DB", "weather.db")


@dataclass
class City:
    id: Optional[int] = None
    name: str = ""          # NOT NULL per spec
    country_code: str = ""

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "country_code": self.country_code}


@dataclass
class WeatherData:
    id: Optional[int] = None
    city_id: int = 0        # FK -> cities
    temp: float = 0.0
    humidity: float = 0.0
    wind_speed: float = 0.0
    fetched_at: Optional[str] = None  # ISO timestamp

    def to_dict(self) -> dict:
        return {
            "id": self.id, "city_id": self.city_id,
            "temp": self.temp, "humidity": self.humidity,
            "wind_speed": self.wind_speed, "fetched_at": self.fetched_at,
        }


@dataclass
class Forecast:
    id: Optional[int] = None
    city_id: int = 0        # FK -> cities
    date: str = ""          # ISO date string
    high: float = 0.0
    low: float = 0.0
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id, "city_id": self.city_id,
            "date": self.date, "high": self.high, "low": self.low,
            "description": self.description,
        }


def init_db(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Initialize SQLite database with schema. Creates tables if they don't exist."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS cities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            country_code TEXT DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(name);

        CREATE TABLE IF NOT EXISTS weather_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL REFERENCES cities(id),
            temp REAL NOT NULL,
            humidity REAL NOT NULL,
            wind_speed REAL NOT NULL,
            fetched_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_weather_city_fetched
            ON weather_data(city_id, fetched_at);

        CREATE TABLE IF NOT EXISTS forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city_id INTEGER NOT NULL REFERENCES cities(id),
            date TEXT NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            description TEXT DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_forecast_city_date
            ON forecasts(city_id, date);
    """)
    conn.commit()
    return conn
