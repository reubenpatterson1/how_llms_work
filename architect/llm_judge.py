"""LLM integration for intelligent response analysis.

Supports multiple providers:
- Ollama (local): llama3.2, mistral, codellama, etc.
- OpenAI API: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- Anthropic API: claude-sonnet-4-20250514, claude-haiku-4-20250414
- Regex fallback: pattern-based analysis (always available)

The LLMJudge uses whichever provider is configured and available,
falling back to regex if the active provider fails.
"""

import json
import os
import re
import sys
import requests
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

from .analyzer import ResponseAnalyzer, DimensionUpdate, Ambiguity
from .channels import ChannelRegistry


# ── Project phases ──

class ProjectPhase(str, Enum):
    POC = "poc"
    MVP = "mvp"
    PREPROD = "preprod"

PROJECT_PHASE_LABELS = {
    ProjectPhase.POC: "Proof of Concept",
    ProjectPhase.MVP: "Minimum Viable Product",
    ProjectPhase.PREPROD: "Pre-Production",
}

# Channels that are critical vs optional per phase
# Critical channels MUST reach threshold; optional channels get a scoring boost
PHASE_CHANNEL_WEIGHTS = {
    ProjectPhase.POC: {
        "critical": {"purpose", "tech_stack", "data_model"},
        "optional": {"auth", "deployment", "error_handling", "performance", "security", "testing"},
        # PoC: focus on proving concept works; skip ops concerns
    },
    ProjectPhase.MVP: {
        "critical": {"purpose", "data_model", "api", "tech_stack", "auth"},
        "optional": {"error_handling", "performance", "security", "testing"},
        # MVP: need working product with auth, but ops can be basic
    },
    ProjectPhase.PREPROD: {
        "critical": {"purpose", "data_model", "api", "tech_stack", "auth",
                     "deployment", "error_handling", "performance", "security", "testing"},
        "optional": set(),
        # Pre-prod: everything matters
    },
}


# ── System prompt shared across all LLM providers ──
# Built dynamically per phase via build_system_prompt()

_SYSTEM_PROMPT_BASE = """You are an architecture intake analyst. Extract ONLY what the user EXPLICITLY stated. NEVER infer, assume, or fill in technologies, patterns, or decisions the user did not mention.

CRITICAL RULES:
- ONLY extract information the user EXPLICITLY stated or clearly implied
- If the user says "portal for lawyers" → extract purpose.users = "lawyers" at 0.5-0.6
- If the user does NOT mention a database → do NOT create a tech_stack.database update
- If the user does NOT mention auth → do NOT create any auth updates
- If the user says "RAG vector DB" but no specific product → extract at 0.5 (mentioned, not specified)
- NEVER output technologies the user didn't name (no inventing Express.js, Redis, JWT, Sentry, etc.)
- NEVER assume an architecture pattern the user didn't describe
- DO extract every distinct piece of information the user provided — enumerate entities, features, sources separately
- If the user lists examples like "discovery, appeal, arraignment" → extract those as scope details at 0.6

The 10 channels and their sub-dimensions are:
1. PURPOSE: objective, users, success_criteria, scope
2. DATA_MODEL: entities, relationships, cardinality, constraints, indexes
3. API: endpoints, request_shapes, response_shapes, versioning, realtime
4. TECH_STACK: language, framework, database, cache, message_queue
5. AUTH: method, authorization, session, mfa
6. DEPLOYMENT: infrastructure, cicd, environments, scaling
7. ERROR_HANDLING: taxonomy, retry, circuit_breaker, logging
8. PERFORMANCE: latency, throughput, optimization, pagination
9. SECURITY: input_validation, encryption, cors, rate_limiting
10. TESTING: strategy, coverage, test_data, ci_integration

Output format — a JSON array of updates for things ACTUALLY stated:
[
  {{
    "channel": "<channel_id lowercase>",
    "sub": "<sub_dimension>",
    "resolution": <float 0.0-1.0>,
    "constraint": "<quote or close paraphrase of what the user said>"
  }}
]

{phase_scoring}

Also identify things the user mentioned vaguely that need follow-up:
[
  {{"text": "<the vague phrase>", "channel": "<channel_id>", "reason": "<what specifically needs clarification>"}}
]

Return ONLY valid JSON: {{"updates": [...], "ambiguities": [...]}}

EXAMPLE — User says: "I'm building a recipe sharing app for home cooks to upload photos and rate dishes, using Supabase"
Correct output:
{{"updates": [
  {{"channel": "purpose", "sub": "objective", "resolution": 0.5, "constraint": "recipe sharing app"}},
  {{"channel": "purpose", "sub": "users", "resolution": 0.6, "constraint": "home cooks"}},
  {{"channel": "purpose", "sub": "scope", "resolution": 0.5, "constraint": "upload photos, rate dishes"}},
  {{"channel": "data_model", "sub": "entities", "resolution": 0.5, "constraint": "recipes, photos, ratings, users"}},
  {{"channel": "tech_stack", "sub": "database", "resolution": 0.7, "constraint": "Supabase"}}
], "ambiguities": [
  {{"text": "rate dishes", "channel": "data_model", "reason": "rating scale not specified (1-5 stars? thumbs up/down?)"}}
]}}
WRONG: Do NOT add auth, deployment, testing, etc. updates — the user didn't mention those topics.

{phase_example}

Remember: extract ONLY what was said. Omit channels the user didn't address at all."""


# ── Phase-specific scoring instructions ──

PHASE_SCORING = {
    ProjectPhase.POC: """Resolution scoring — PoC / Proof of Concept calibration:
This is a PROOF OF CONCEPT. The goal is to validate feasibility, NOT production readiness.
Score decisions generously — a PoC doesn't need exhaustive detail.

- 0.3-0.4: Topic area barely touched ("I need something")
- 0.5: Mentioned with basic context ("a portal for lawyers")
- 0.6-0.7: Described with enough detail to prototype ("upload docs, RAG with vector DB")
- 0.8: A CLEAR decision, even if simple ("No auth for PoC", "SQLite for now", "No versioning")
- 0.9: Specific enough to implement immediately ("ChromaDB local, cosine similarity")
- 1.0: Fully nailed down

IMPORTANT for PoC:
- "Not needed for PoC" or "Skip for now" = 0.9 (deliberate exclusion IS a decision)
- "No auth" for a PoC = 0.9 (correct PoC scoping, not a gap)
- Channels like deployment, security, testing can be resolved with minimal detail
- Focus scoring weight on purpose, tech_stack, and data_model""",

    ProjectPhase.MVP: """Resolution scoring — MVP calibration:
This is a MINIMUM VIABLE PRODUCT. The goal is a working product for real users, but NOT feature-complete.

- 0.3-0.4: Topic area touched but nothing specific ("I need a portal")
- 0.5: Mentioned with some context ("document summary portal for lawyers")
- 0.6: Partially described with a few details ("upload documents for discovery, appeal hearings")
- 0.7: Well described with multiple specifics ("RAG vector DB with Google Scholar, FindLaw sources")
- 0.8: A CLEAR, DEFINITIVE decision or precise specification ("No versioning for MVP", "PostgreSQL 16")
- 0.9: Fully specified with implementation-level details ("JWT with RS256, 15min access tokens")
- 1.0: Exhaustively specified with edge cases and error handling

IMPORTANT for MVP:
- A direct, unambiguous answer to a specific question is a CLEAR DECISION → 0.8+
- "No versioning for MVP" → 0.8 (definitive choice)
- "Maybe REST" → 0.5 (tentative, needs confirmation)
- "Defer to post-MVP" for non-critical channels → 0.7 (acknowledged but not resolved)""",

    ProjectPhase.PREPROD: """Resolution scoring — Pre-Production calibration:
This is PRE-PRODUCTION architecture. Every channel needs rigorous specification.
Score STRICTLY — production systems need precise, implementable details.

- 0.3-0.4: Topic area touched but nothing actionable ("I need a portal")
- 0.5: Mentioned with basic context ("document portal for lawyers") — needs much more
- 0.6: Partially described ("upload documents for various hearing types")
- 0.7: Well described but missing implementation detail ("RAG with vector DB and multiple sources")
- 0.8: Precisely specified with exact values ("PostgreSQL 16.2", "REST with /api/v1 prefix")
- 0.9: Fully specified with implementation details ("JWT RS256, 15min access + 7day refresh, Redis session store")
- 1.0: Exhaustively specified with edge cases, error handling, and migration strategy

IMPORTANT for Pre-Production:
- "No versioning" is NOT 0.8 here — it needs justification and migration plan → 0.6
- "No auth" is a RED FLAG for pre-prod — flag as ambiguity unless explicitly justified
- Every channel is critical — deployment, security, testing, error handling ALL matter
- Prefer 0.5-0.7 range unless user gave implementation-ready specifics""",
}

PHASE_EXAMPLES = {
    ProjectPhase.POC: """EXAMPLE 2 — PoC phase, agent asked about auth, user answers: "No auth for the PoC"
Correct output:
{{"updates": [
  {{"channel": "auth", "sub": "method", "resolution": 0.9, "constraint": "No auth for PoC — deliberate scoping decision"}}
], "ambiguities": []}}
NOTE: Deliberately skipping a concern for PoC IS a valid architectural decision → 0.9.""",

    ProjectPhase.MVP: """EXAMPLE 2 — MVP phase, agent asked about API versioning, user answers: "No versioning for MVP"
Correct output:
{{"updates": [
  {{"channel": "api", "sub": "versioning", "resolution": 0.8, "constraint": "No versioning for MVP"}}
], "ambiguities": []}}
NOTE: The user gave a CLEAR, DEFINITIVE answer → 0.8. Do NOT score direct decisions below 0.8.""",

    ProjectPhase.PREPROD: """EXAMPLE 2 — Pre-prod phase, agent asked about API versioning, user answers: "No versioning"
Correct output:
{{"updates": [
  {{"channel": "api", "sub": "versioning", "resolution": 0.6, "constraint": "No API versioning planned"}}
], "ambiguities": [
  {{"text": "No versioning", "channel": "api", "reason": "Pre-production API needs versioning strategy — how will breaking changes be communicated to consumers? Consider URL path (/v1/) or header-based versioning."}}
]}}
NOTE: For pre-prod, "no versioning" is incomplete — it needs justification and a migration plan.""",
}


def build_system_prompt(phase: ProjectPhase = ProjectPhase.MVP) -> str:
    """Build the system prompt calibrated for the given project phase."""
    return _SYSTEM_PROMPT_BASE.format(
        phase_scoring=PHASE_SCORING[phase],
        phase_example=PHASE_EXAMPLES[phase],
    )

# Default for backward compatibility
SYSTEM_PROMPT = build_system_prompt(ProjectPhase.MVP)


# ── Provider definitions ──

class ProviderType(str, Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    REGEX = "regex"


@dataclass
class ProviderConfig:
    type: ProviderType
    model: str = ""
    api_key: str = ""
    base_url: str = ""
    temperature: float = 0.1
    max_tokens: int = 2048
    timeout: int = 120

    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "model": self.model,
            "api_key": "***" if self.api_key else "",
            "base_url": self.base_url,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "timeout": self.timeout,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ProviderConfig":
        return cls(
            type=ProviderType(data.get("type", "regex")),
            model=data.get("model", ""),
            api_key=data.get("api_key", ""),
            base_url=data.get("base_url", ""),
            temperature=float(data.get("temperature", 0.1)),
            max_tokens=int(data.get("max_tokens", 2048)),
            timeout=int(data.get("timeout", 120)),
        )


# ── Default provider configs ──

PROVIDER_DEFAULTS = {
    ProviderType.OLLAMA: ProviderConfig(
        type=ProviderType.OLLAMA,
        model="llama3.2",
        base_url="http://localhost:11434",
        temperature=0.1,
        max_tokens=2048,
        timeout=120,
    ),
    ProviderType.OPENAI: ProviderConfig(
        type=ProviderType.OPENAI,
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        api_key=os.environ.get("OPENAI_API_KEY", ""),
        temperature=0.1,
        max_tokens=2048,
        timeout=60,
    ),
    ProviderType.ANTHROPIC: ProviderConfig(
        type=ProviderType.ANTHROPIC,
        model="claude-sonnet-4-20250514",
        base_url="https://api.anthropic.com",
        api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
        temperature=0.1,
        max_tokens=2048,
        timeout=60,
    ),
    ProviderType.REGEX: ProviderConfig(
        type=ProviderType.REGEX,
        model="regex-patterns",
    ),
}

# ── Available models per provider ──

AVAILABLE_MODELS = {
    ProviderType.OLLAMA: [],  # Populated dynamically from Ollama
    ProviderType.OPENAI: [
        "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo",
        "o3-mini",
    ],
    ProviderType.ANTHROPIC: [
        "claude-sonnet-4-20250514", "claude-haiku-4-20250414",
        "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022",
    ],
    ProviderType.REGEX: ["regex-patterns"],
}


# ── Provider query functions ──

def _build_prompt(user_response: str, context: str = "") -> str:
    return f"""Analyze this user response and extract architectural constraints.

Context about what we've already collected:
{context if context else "This is the first response."}

User response:
{user_response}

Return ONLY the JSON object with "updates" and "ambiguities" arrays."""


def _parse_llm_response(text: str) -> Optional[dict]:
    """Parse the LLM's JSON response, handling common formatting issues."""
    if not text or not text.strip():
        print("[LLM Judge] Empty response text", file=sys.stderr)
        return None

    # Try direct parse
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            result = json.loads(json_match.group(1))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    # Try to find first { to last } — use brace counting for nested objects
    start = text.find('{')
    if start >= 0:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    try:
                        result = json.loads(text[start:i + 1])
                        if isinstance(result, dict):
                            return result
                    except json.JSONDecodeError:
                        break

    # Last resort: try first { to last }
    end = text.rfind('}')
    if start >= 0 and end > start:
        try:
            result = json.loads(text[start:end + 1])
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

    print(f"[LLM Judge] Failed to parse response. First 500 chars: {text[:500]}", file=sys.stderr)
    return None


def query_ollama(config: ProviderConfig, user_response: str, context: str = "",
                 system_prompt: str = "") -> Optional[dict]:
    """Query Ollama local LLM."""
    prompt = _build_prompt(user_response, context)
    try:
        r = requests.post(
            f"{config.base_url}/api/generate",
            json={
                "model": config.model,
                "prompt": prompt,
                "system": system_prompt or SYSTEM_PROMPT,
                "stream": False,
                "options": {
                    "temperature": config.temperature,
                    "num_predict": config.max_tokens,
                },
            },
            timeout=config.timeout,
        )
        if r.status_code == 200:
            text = r.json().get("response", "")
            print(f"[LLM Judge] Ollama response length: {len(text)}, first 300: {text[:300]}", file=sys.stderr)
            parsed = _parse_llm_response(text)
            if parsed is None:
                print(f"[LLM Judge] Ollama parse FAILED. Full response:\n{text[:1000]}", file=sys.stderr)
            return parsed
        else:
            print(f"[LLM Judge] Ollama returned status {r.status_code}", file=sys.stderr)
    except requests.Timeout:
        print("[LLM Judge] Ollama request timed out", file=sys.stderr)
    except (requests.ConnectionError, json.JSONDecodeError) as e:
        print(f"[LLM Judge] Ollama error: {e}", file=sys.stderr)
    return None


def query_openai(config: ProviderConfig, user_response: str, context: str = "",
                 system_prompt: str = "") -> Optional[dict]:
    """Query OpenAI API."""
    prompt = _build_prompt(user_response, context)
    if not config.api_key:
        print("[LLM Judge] OpenAI API key not set", file=sys.stderr)
        return None
    try:
        r = requests.post(
            f"{config.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": config.model,
                "messages": [
                    {"role": "system", "content": system_prompt or SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": config.temperature,
                "max_tokens": config.max_tokens,
            },
            timeout=config.timeout,
        )
        if r.status_code == 200:
            text = r.json()["choices"][0]["message"]["content"]
            print(f"[LLM Judge] OpenAI response length: {len(text)}, first 300: {text[:300]}", file=sys.stderr)
            parsed = _parse_llm_response(text)
            if parsed is None:
                print(f"[LLM Judge] OpenAI parse FAILED. Full response:\n{text[:1000]}", file=sys.stderr)
            return parsed
        else:
            print(f"[LLM Judge] OpenAI returned {r.status_code}: {r.text[:200]}", file=sys.stderr)
    except requests.Timeout:
        print("[LLM Judge] OpenAI request timed out", file=sys.stderr)
    except (requests.ConnectionError, json.JSONDecodeError, KeyError) as e:
        print(f"[LLM Judge] OpenAI error: {e}", file=sys.stderr)
    return None


def query_anthropic(config: ProviderConfig, user_response: str, context: str = "",
                    system_prompt: str = "") -> Optional[dict]:
    """Query Anthropic API."""
    prompt = _build_prompt(user_response, context)
    if not config.api_key:
        print("[LLM Judge] Anthropic API key not set", file=sys.stderr)
        return None
    try:
        r = requests.post(
            f"{config.base_url}/v1/messages",
            headers={
                "x-api-key": config.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": config.model,
                "max_tokens": config.max_tokens,
                "system": system_prompt or SYSTEM_PROMPT,
                "messages": [
                    {"role": "user", "content": prompt},
                ],
                "temperature": config.temperature,
            },
            timeout=config.timeout,
        )
        if r.status_code == 200:
            content = r.json().get("content", [])
            text = content[0]["text"] if content else ""
            print(f"[LLM Judge] Anthropic response length: {len(text)}, first 300: {text[:300]}", file=sys.stderr)
            parsed = _parse_llm_response(text)
            if parsed is None:
                print(f"[LLM Judge] Anthropic parse FAILED. Full response:\n{text[:1000]}", file=sys.stderr)
            return parsed
        else:
            print(f"[LLM Judge] Anthropic returned {r.status_code}: {r.text[:200]}", file=sys.stderr)
    except requests.Timeout:
        print("[LLM Judge] Anthropic request timed out", file=sys.stderr)
    except (requests.ConnectionError, json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"[LLM Judge] Anthropic error: {e}", file=sys.stderr)
    return None


QUERY_FUNCTIONS = {
    ProviderType.OLLAMA: query_ollama,
    ProviderType.OPENAI: query_openai,
    ProviderType.ANTHROPIC: query_anthropic,
}


# ── Provider availability checks ──

def check_ollama(config: ProviderConfig) -> dict:
    """Check Ollama availability and list models."""
    try:
        r = requests.get(f"{config.base_url}/api/tags", timeout=3)
        if r.status_code == 200:
            models = r.json().get("models", [])
            model_names = [m.get("name", "") for m in models]
            active = any(config.model in name for name in model_names)
            return {
                "available": True,
                "active_model_found": active,
                "models": model_names,
                "error": None,
            }
    except (requests.ConnectionError, requests.Timeout) as e:
        return {"available": False, "active_model_found": False, "models": [], "error": str(e)}
    return {"available": False, "active_model_found": False, "models": [], "error": "Unknown error"}


def check_openai(config: ProviderConfig) -> dict:
    """Check OpenAI API availability."""
    if not config.api_key:
        return {"available": False, "error": "API key not set", "models": AVAILABLE_MODELS[ProviderType.OPENAI]}
    try:
        r = requests.get(
            f"{config.base_url}/models",
            headers={"Authorization": f"Bearer {config.api_key}"},
            timeout=5,
        )
        if r.status_code == 200:
            return {"available": True, "error": None, "models": AVAILABLE_MODELS[ProviderType.OPENAI]}
        return {"available": False, "error": f"Status {r.status_code}", "models": AVAILABLE_MODELS[ProviderType.OPENAI]}
    except (requests.ConnectionError, requests.Timeout) as e:
        return {"available": False, "error": str(e), "models": AVAILABLE_MODELS[ProviderType.OPENAI]}


def check_anthropic(config: ProviderConfig) -> dict:
    """Check Anthropic API availability by making a lightweight API call."""
    if not config.api_key:
        return {"available": False, "error": "API key not set", "models": AVAILABLE_MODELS[ProviderType.ANTHROPIC]}
    # Validate by making a minimal API call (count tokens endpoint or a tiny message)
    try:
        r = requests.post(
            f"{config.base_url}/v1/messages",
            headers={
                "x-api-key": config.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": config.model,
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "hi"}],
            },
            timeout=10,
        )
        if r.status_code == 200:
            return {"available": True, "error": None, "models": AVAILABLE_MODELS[ProviderType.ANTHROPIC]}
        elif r.status_code == 401:
            return {"available": False, "error": "Invalid API key", "models": AVAILABLE_MODELS[ProviderType.ANTHROPIC]}
        else:
            # Parse error message from response
            try:
                err_data = r.json()
                err_msg = err_data.get("error", {}).get("message", f"HTTP {r.status_code}")
            except (json.JSONDecodeError, AttributeError):
                err_msg = f"HTTP {r.status_code}"
            return {"available": False, "error": err_msg, "models": AVAILABLE_MODELS[ProviderType.ANTHROPIC]}
    except (requests.ConnectionError, requests.Timeout) as e:
        return {"available": False, "error": f"Connection failed: {e}", "models": AVAILABLE_MODELS[ProviderType.ANTHROPIC]}


CHECK_FUNCTIONS = {
    ProviderType.OLLAMA: check_ollama,
    ProviderType.OPENAI: check_openai,
    ProviderType.ANTHROPIC: check_anthropic,
}


# ── LLMJudge: main class ──

class LLMJudge:
    """Multi-provider LLM analyzer with regex fallback."""

    def __init__(self, registry: ChannelRegistry, config: Optional[ProviderConfig] = None,
                 phase: ProjectPhase = ProjectPhase.MVP):
        self.registry = registry
        self.regex_analyzer = ResponseAnalyzer()
        self._analysis_log: list[dict] = []
        self._phase = phase

        # Default: try Ollama first
        if config:
            self._config = config
        else:
            self._config = ProviderConfig(
                type=ProviderType.OLLAMA,
                model="llama3.2",
                base_url="http://localhost:11434",
                temperature=0.1,
                max_tokens=2048,
                timeout=120,
            )

        self._provider_status: Optional[dict] = None
        self._last_fallback_reason: str | None = None

    @property
    def config(self) -> ProviderConfig:
        return self._config

    def set_config(self, config: ProviderConfig):
        """Update the active provider configuration."""
        self._config = config
        self._provider_status = None  # Reset cached status

    @property
    def phase(self) -> ProjectPhase:
        return self._phase

    @phase.setter
    def phase(self, value: ProjectPhase):
        self._phase = value

    @property
    def phase_label(self) -> str:
        return PROJECT_PHASE_LABELS.get(self._phase, self._phase.value)

    @property
    def active_provider(self) -> str:
        return self._config.type.value

    @property
    def active_model(self) -> str:
        return self._config.model

    @property
    def provider_available(self) -> bool:
        """Check if the active provider is available."""
        if self._config.type == ProviderType.REGEX:
            return True
        status = self.check_provider()
        return status.get("available", False)

    def check_provider(self) -> dict:
        """Check the active provider's availability."""
        if self._config.type == ProviderType.REGEX:
            return {"available": True, "error": None, "models": ["regex-patterns"]}

        check_fn = CHECK_FUNCTIONS.get(self._config.type)
        if check_fn:
            self._provider_status = check_fn(self._config)
            return self._provider_status

        return {"available": False, "error": f"Unknown provider: {self._config.type}"}

    def list_ollama_models(self) -> list[str]:
        """List locally available Ollama models."""
        try:
            r = requests.get(f"{self._config.base_url}/api/tags", timeout=3)
            if r.status_code == 200:
                return [m.get("name", "") for m in r.json().get("models", [])]
        except (requests.ConnectionError, requests.Timeout):
            pass
        return []

    @property
    def completion_threshold(self) -> float:
        """Phase-aware completion threshold."""
        return {
            ProjectPhase.POC: 0.6,
            ProjectPhase.MVP: 0.8,
            ProjectPhase.PREPROD: 0.85,
        }.get(self._phase, 0.8)

    @property
    def critical_channels(self) -> set[str]:
        """Channels that are critical for the current phase."""
        return PHASE_CHANNEL_WEIGHTS.get(self._phase, {}).get("critical", set())

    @property
    def optional_channels(self) -> set[str]:
        """Channels that are optional for the current phase."""
        return PHASE_CHANNEL_WEIGHTS.get(self._phase, {}).get("optional", set())

    @property
    def last_fallback_reason(self) -> str | None:
        """Why the last analyze() call fell back to regex, if it did."""
        return self._last_fallback_reason

    def analyze(self, response: str) -> tuple[list[DimensionUpdate], list[Ambiguity], str]:
        """Analyze a response. Returns (updates, ambiguities, method_used).

        method_used describes which provider+model was used, or 'regex' for fallback.
        """
        method = "regex"
        updates = []
        ambiguities = []
        self._last_fallback_reason = None

        # Try the configured LLM provider
        if self._config.type != ProviderType.REGEX:
            query_fn = QUERY_FUNCTIONS.get(self._config.type)
            if query_fn:
                print(f"[LLM Judge] Querying {self._config.type.value}:{self._config.model} (phase={self._phase.value})", file=sys.stderr)
                context = self._build_context()
                phase_prompt = build_system_prompt(self._phase)
                result = query_fn(self._config, response, context, system_prompt=phase_prompt)
                if result is None:
                    self._last_fallback_reason = f"{self._config.type.value} query failed — check provider status in Settings"
                    print(f"[LLM Judge] Provider returned None — falling back to regex", file=sys.stderr)
                elif "updates" not in result:
                    self._last_fallback_reason = f"LLM response missing 'updates' key"
                    print(f"[LLM Judge] Response has no 'updates' key. Keys: {list(result.keys())}", file=sys.stderr)
                else:
                    method = f"{self._config.type.value}:{self._config.model}"
                    updates = self._parse_updates(result.get("updates", []))
                    ambiguities = self._parse_ambiguities(result.get("ambiguities", []))
                    print(f"[LLM Judge] LLM returned {len(updates)} updates, {len(ambiguities)} ambiguities", file=sys.stderr)
            else:
                self._last_fallback_reason = f"No query function for {self._config.type}"
                print(f"[LLM Judge] No query function for {self._config.type}", file=sys.stderr)

        # Fall back to regex or merge with regex results
        if method == "regex" or not updates:
            regex_updates = self.regex_analyzer.analyze(response)
            regex_ambiguities = self.regex_analyzer.identify_ambiguities(response)
            if method == "regex":
                updates = regex_updates
                ambiguities = regex_ambiguities
            else:
                # Merge: add any regex findings not already covered by LLM
                existing_keys = {(u.channel_id, u.sub_dimension) for u in updates}
                for ru in regex_updates:
                    if (ru.channel_id, ru.sub_dimension) not in existing_keys:
                        updates.append(ru)
                        existing_keys.add((ru.channel_id, ru.sub_dimension))

        self._analysis_log.append({
            "response": response[:200],
            "method": method,
            "update_count": len(updates),
            "ambiguity_count": len(ambiguities),
        })

        return updates, ambiguities, method

    def _build_context(self) -> str:
        """Build context string showing current channel state."""
        lines = []
        for ch_id, ch in self.registry.channels.items():
            if ch.resolution > 0:
                lines.append(f"{ch.name} ({ch.resolution:.0%}): {', '.join(ch.constraints[:5])}")
            else:
                lines.append(f"{ch.name}: unresolved")
        return "\n".join(lines)

    def _parse_updates(self, raw_updates: list[dict]) -> list[DimensionUpdate]:
        """Convert LLM JSON updates to DimensionUpdate objects."""
        updates = []
        seen = set()
        for u in raw_updates:
            ch = u.get("channel", "").lower().strip()
            sub = u.get("sub", "").lower().strip()
            res = float(u.get("resolution", 0.5))
            constraint = u.get("constraint", "")

            # Validate channel and sub-dimension exist
            channel = self.registry.get(ch)
            if not channel or sub not in channel.sub_dimensions:
                continue

            key = (ch, sub)
            if key in seen:
                continue
            seen.add(key)

            res = max(0.0, min(1.0, res))
            updates.append(DimensionUpdate(ch, sub, res, constraint))

        return updates

    def _parse_ambiguities(self, raw_ambiguities: list[dict]) -> list[Ambiguity]:
        """Convert LLM JSON ambiguities to Ambiguity objects."""
        return [
            Ambiguity(
                text=a.get("text", ""),
                channel_id=a.get("channel", ""),
                reason=a.get("reason", ""),
            )
            for a in raw_ambiguities
            if a.get("text")
        ]

    @property
    def analysis_log(self) -> list[dict]:
        return list(self._analysis_log)
