"""Auth service: API key via X-API-Key header, single tier, no roles.

From dense spec:
- API key auth via X-API-Key header
- single tier, no roles
- Input sanitization max 100 chars
- Rate limit 60/min per key

Implements IAuthService interface:
- authenticate(credentials) -> AuthToken
- validate_token(token) -> TokenPayload
- authorize(user_id, permission) -> bool
"""

import time
import os
from dataclasses import dataclass
from functools import wraps
from flask import request, jsonify


# Valid API keys — in production these would be in a database
# For PoC, use environment variable or hardcoded demo key
VALID_API_KEYS = set(
    os.environ.get("WEATHER_API_KEYS", "demo-key-001,demo-key-002").split(",")
)


@dataclass
class AuthCredentials:
    api_key: str


@dataclass
class AuthToken:
    key: str
    valid: bool


@dataclass
class TokenPayload:
    key: str
    tier: str = "standard"  # single tier per spec


# ── Rate limiter: 60 req/min per key ──

_rate_store: dict[str, list[float]] = {}
RATE_LIMIT = 60
RATE_WINDOW = 60  # seconds


def _check_rate_limit(api_key: str) -> bool:
    """Returns True if within rate limit, False if exceeded."""
    now = time.time()
    if api_key not in _rate_store:
        _rate_store[api_key] = []

    # Prune old entries
    _rate_store[api_key] = [t for t in _rate_store[api_key] if now - t < RATE_WINDOW]

    if len(_rate_store[api_key]) >= RATE_LIMIT:
        return False

    _rate_store[api_key].append(now)
    return True


# ── IAuthService implementation ──

def authenticate(credentials: AuthCredentials) -> AuthToken:
    """Validate an API key."""
    valid = credentials.api_key in VALID_API_KEYS
    return AuthToken(key=credentials.api_key, valid=valid)


def validate_token(token: str) -> TokenPayload | None:
    """Validate and decode an API key token."""
    if token in VALID_API_KEYS:
        return TokenPayload(key=token, tier="standard")
    return None


def authorize(user_id: str, permission: str) -> bool:
    """Single tier — all authenticated users have all permissions."""
    return True


# ── Flask middleware decorator ──

def require_api_key(f):
    """Flask route decorator: require valid X-API-Key header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get("X-API-Key", "").strip()

        if not api_key:
            return jsonify({"status": "error", "message": "Missing X-API-Key header"}), 401

        # Input sanitization: max 100 chars per spec
        if len(api_key) > 100:
            return jsonify({"status": "error", "message": "API key too long"}), 400

        token = authenticate(AuthCredentials(api_key=api_key))
        if not token.valid:
            return jsonify({"status": "error", "message": "Invalid API key"}), 401

        # Rate limiting: 60/min per key
        if not _check_rate_limit(api_key):
            return jsonify({"status": "error", "message": "Rate limit exceeded (60/min)"}), 429

        return f(*args, **kwargs)
    return decorated
