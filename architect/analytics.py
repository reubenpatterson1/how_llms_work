"""Analytics backend for LLM Engineering Course.

Tracks user sessions, module completions, and quiz results in SQLite.
"""

import json
import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "analytics.db")


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL,
                user_agent TEXT
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                module TEXT,
                data TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
            CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
            CREATE INDEX IF NOT EXISTS idx_events_module ON events(module);
        """)


def record_event(user_id, event_type, module=None, data=None, user_agent=None):
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        # Upsert user
        db.execute("""
            INSERT INTO users (user_id, first_seen, last_seen, user_agent)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET last_seen=?, user_agent=COALESCE(?, user_agent)
        """, (user_id, now, now, user_agent, now, user_agent))

        db.execute("""
            INSERT INTO events (user_id, event_type, module, data, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, event_type, module, json.dumps(data) if data else None, now))


def get_dashboard_data():
    with get_db() as db:
        # Total users
        total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]

        # Active today
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        active_today = db.execute(
            "SELECT COUNT(DISTINCT user_id) FROM events WHERE created_at >= ?", (today,)
        ).fetchone()[0]

        # Module completions
        module_completions = {}
        rows = db.execute("""
            SELECT module, COUNT(DISTINCT user_id) as users
            FROM events WHERE event_type = 'module_complete'
            GROUP BY module ORDER BY module
        """).fetchall()
        for r in rows:
            module_completions[r["module"]] = r["users"]

        # Quiz results
        quiz_results = []
        rows = db.execute("""
            SELECT e.user_id, e.module, e.data, e.created_at,
                   u.first_seen
            FROM events e JOIN users u ON e.user_id = u.user_id
            WHERE e.event_type = 'quiz_complete'
            ORDER BY e.created_at DESC LIMIT 50
        """).fetchall()
        for r in rows:
            data = json.loads(r["data"]) if r["data"] else {}
            quiz_results.append({
                "user_id": r["user_id"][:8] + "...",
                "module": r["module"],
                "score": data.get("score"),
                "total": data.get("total"),
                "passed": data.get("passed"),
                "name": data.get("name", ""),
                "created_at": r["created_at"],
            })

        # Completion funnel
        funnel = {}
        for i in range(1, 7):
            mod = f"part{i}"
            funnel[mod] = {
                "started": db.execute(
                    "SELECT COUNT(DISTINCT user_id) FROM events WHERE module=? AND event_type='module_start'",
                    (mod,)
                ).fetchone()[0],
                "completed": db.execute(
                    "SELECT COUNT(DISTINCT user_id) FROM events WHERE module=? AND event_type='module_complete'",
                    (mod,)
                ).fetchone()[0],
                "quiz_taken": db.execute(
                    "SELECT COUNT(DISTINCT user_id) FROM events WHERE module=? AND event_type='quiz_complete'",
                    (mod,)
                ).fetchone()[0],
            }

        # Recent activity
        recent = []
        rows = db.execute("""
            SELECT user_id, event_type, module, created_at
            FROM events ORDER BY created_at DESC LIMIT 30
        """).fetchall()
        for r in rows:
            recent.append({
                "user_id": r["user_id"][:8] + "...",
                "event_type": r["event_type"],
                "module": r["module"],
                "created_at": r["created_at"],
            })

        # Per-user progress
        user_progress = []
        rows = db.execute("""
            SELECT u.user_id, u.first_seen, u.last_seen,
                   COUNT(DISTINCT CASE WHEN e.event_type='module_complete' THEN e.module END) as modules_completed,
                   COUNT(DISTINCT CASE WHEN e.event_type='quiz_complete' THEN e.module END) as quizzes_taken
            FROM users u LEFT JOIN events e ON u.user_id = e.user_id
            GROUP BY u.user_id ORDER BY u.last_seen DESC LIMIT 100
        """).fetchall()
        for r in rows:
            user_progress.append({
                "user_id": r["user_id"][:8] + "...",
                "first_seen": r["first_seen"],
                "last_seen": r["last_seen"],
                "modules_completed": r["modules_completed"],
                "quizzes_taken": r["quizzes_taken"],
            })

        return {
            "total_users": total_users,
            "active_today": active_today,
            "module_completions": module_completions,
            "funnel": funnel,
            "quiz_results": quiz_results,
            "recent_activity": recent,
            "user_progress": user_progress,
        }


# Initialize on import
init_db()
