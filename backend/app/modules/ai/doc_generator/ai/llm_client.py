"""
==========================================================
                GROQ LLM CLIENT
==========================================================

Thin wrapper around Groq's chat-completions API (OpenAI-SDK
compatible, so this reads almost identically to an OpenAI
integration). This file was previously empty — no AI module
in this project called any LLM at all before this.

Free tier, no card required: https://console.groq.com
"""

import logging

from groq import Groq, APIError, APIConnectionError

from app.core.config import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger(__name__)

_client: Groq | None = None


def _get_client() -> Groq:
    """Lazily construct the Groq client so importing this module never
    fails just because the API key isn't set yet (e.g. during tests)."""
    global _client
    if _client is None:
        if not GROQ_API_KEY:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Add it to your .env file — "
                "get a free key at https://console.groq.com"
            )
        _client = Groq(api_key=GROQ_API_KEY)
    return _client


def generate_text(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
    max_tokens: int = 2048,
) -> str:
    """
    Sends one chat-completion request to Groq and returns the generated
    text as a plain string.

    Raises RuntimeError on any failure (missing key, network issue, or
    a Groq API error) with a clean, human-readable message — callers in
    service.py should catch RuntimeError and turn it into an
    HTTPException, rather than letting a raw Groq exception surface.
    """
    client = _get_client()

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except APIConnectionError as exc:
        logger.error("Groq connection error: %s", exc)
        raise RuntimeError("Could not reach the Groq API. Check your internet connection.") from exc
    except APIError as exc:
        logger.error("Groq API error: %s", exc)
        raise RuntimeError(f"Groq API error: {exc}") from exc

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Groq returned an empty response.")

    return content


def generate_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 3000,
) -> dict:
    """
    Like generate_text(), but requests Groq's JSON Object Mode so the
    response is guaranteed to be syntactically valid JSON — the system
    prompt is still responsible for describing the exact shape (JSON
    mode enforces well-formed JSON, not a specific schema; the caller
    validates the parsed dict against a Pydantic model afterward).

    Raises RuntimeError on any Groq failure (same as generate_text), or
    if Groq's response, despite being requested as JSON, can't actually
    be parsed as JSON (rare, but possible with weaker models).
    """
    import json

    client = _get_client()

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
    except APIConnectionError as exc:
        logger.error("Groq connection error: %s", exc)
        raise RuntimeError("Could not reach the Groq API. Check your internet connection.") from exc
    except APIError as exc:
        logger.error("Groq API error: %s", exc)
        raise RuntimeError(f"Groq API error: {exc}") from exc

    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Groq returned an empty response.")

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error("Groq JSON mode returned unparseable content: %s", content[:500])
        raise RuntimeError("The AI returned an invalid document structure. Please regenerate.") from exc
