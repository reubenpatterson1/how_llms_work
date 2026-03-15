"""Local LLM integration via Ollama for intelligent response analysis.

Uses llama3.2 to parse user responses into structured channel updates,
replacing brittle regex patterns with genuine language understanding.
Falls back to the regex-based analyzer if Ollama is unavailable.
"""

import json
import re
import requests
from dataclasses import dataclass
from typing import Optional

from .analyzer import ResponseAnalyzer, DimensionUpdate, Ambiguity
from .channels import ChannelRegistry

OLLAMA_URL = "http://localhost:11434"
MODEL = "llama3.2"

# System prompt that teaches the LLM about the channel architecture
SYSTEM_PROMPT = """You are an architecture intake analyst. Your job is to extract precise architectural constraints from user responses and map them to resolution channels.

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

For each piece of information in the user's response, output a JSON array of updates:
[
  {
    "channel": "<channel_id lowercase>",
    "sub": "<sub_dimension>",
    "resolution": <float 0.0-1.0>,
    "constraint": "<one-line constraint description>"
  }
]

Resolution scoring guide:
- 0.5: Mentioned but vague ("we need auth")
- 0.6-0.7: Partially specified ("JWT tokens with roles")
- 0.8: Well specified ("JWT RS256, 15min access, 7d refresh, RBAC with admin/member/viewer")
- 0.9: Fully specified with exact values ("PostgreSQL 15 with Prisma ORM, pool size 20")
- 1.0: Exhaustively specified with all edge cases

Also identify ambiguities — vague terms that need clarification:
[
  {"text": "<the vague phrase>", "channel": "<channel_id>", "reason": "<why it's ambiguous>"}
]

Return ONLY valid JSON in this exact format:
{"updates": [...], "ambiguities": [...]}

Be thorough. Extract EVERY architectural decision, no matter how small."""


def _check_ollama() -> bool:
    """Check if Ollama is running and the model is available."""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        if r.status_code == 200:
            models = r.json().get("models", [])
            return any(MODEL in m.get("name", "") for m in models)
    except (requests.ConnectionError, requests.Timeout):
        pass
    return False


def _query_ollama(user_response: str, context: str = "") -> Optional[dict]:
    """Send a response to Ollama for analysis."""
    prompt = f"""Analyze this user response and extract architectural constraints.

Context about what we've already collected:
{context if context else "This is the first response."}

User response:
{user_response}

Return ONLY the JSON object with "updates" and "ambiguities" arrays."""

    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL,
                "prompt": prompt,
                "system": SYSTEM_PROMPT,
                "stream": False,
                "options": {
                    "temperature": 0.1,  # Low temp for structured output
                    "num_predict": 2048,
                },
            },
            timeout=120,  # llama3.2 can take time on complex prompts
        )
        if r.status_code == 200:
            text = r.json().get("response", "")
            import sys
            print(f"[LLM Judge] Raw response length: {len(text)}", file=sys.stderr)
            print(f"[LLM Judge] First 300 chars: {text[:300]}", file=sys.stderr)
            parsed = _parse_llm_response(text)
            if parsed is None:
                print(f"[LLM Judge] Failed to parse JSON from response", file=sys.stderr)
            return parsed
        else:
            import sys
            print(f"[LLM Judge] Ollama returned status {r.status_code}", file=sys.stderr)
    except requests.Timeout:
        import sys
        print("[LLM Judge] Ollama request timed out", file=sys.stderr)
    except (requests.ConnectionError, json.JSONDecodeError) as e:
        import sys
        print(f"[LLM Judge] Error: {e}", file=sys.stderr)
    return None


def _parse_llm_response(text: str) -> Optional[dict]:
    """Parse the LLM's JSON response, handling common formatting issues."""
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find first { to last }
    start = text.find('{')
    end = text.rfind('}')
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None


class LLMJudge:
    """Hybrid analyzer: uses local LLM when available, falls back to regex."""

    def __init__(self, registry: ChannelRegistry):
        self.registry = registry
        self.regex_analyzer = ResponseAnalyzer()
        self._ollama_available: Optional[bool] = None
        self._analysis_log: list[dict] = []

    @property
    def ollama_available(self) -> bool:
        if self._ollama_available is None:
            self._ollama_available = _check_ollama()
        return self._ollama_available

    def refresh_ollama_status(self) -> bool:
        """Re-check Ollama availability."""
        self._ollama_available = _check_ollama()
        return self._ollama_available

    def analyze(self, response: str) -> tuple[list[DimensionUpdate], list[Ambiguity], str]:
        """Analyze a response. Returns (updates, ambiguities, method_used).

        method_used is 'llm' or 'regex' depending on which analyzer ran.
        """
        method = "regex"
        updates = []
        ambiguities = []

        if self.ollama_available:
            context = self._build_context()
            result = _query_ollama(response, context)
            if result and "updates" in result:
                method = "llm"
                updates = self._parse_updates(result.get("updates", []))
                ambiguities = self._parse_ambiguities(result.get("ambiguities", []))

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
