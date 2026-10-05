"""Claude integration (Anthropic SDK) for chat and valuation commentary."""
import logging
import os
from typing import AsyncIterator

from anthropic import AsyncAnthropic, APIConnectionError, APIStatusError, RateLimitError

logger = logging.getLogger(__name__)

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
# Chat answers are short and latency-sensitive → low effort is enough.
EFFORT = os.environ.get("ANTHROPIC_EFFORT", "low")
CHAT_MAX_TOKENS = 4096
COMMENTARY_MAX_TOKENS = 2048
FALLBACK_BETA = "server-side-fallback-2026-07-01"

_client: AsyncAnthropic | None = None


def is_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(timeout=60.0, max_retries=2)
    return _client


def _request_params(system: str, messages: list[dict], max_tokens: int) -> dict:
    return {
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
        "output_config": {"effort": EFFORT},
        "betas": [FALLBACK_BETA],
        "fallbacks": "default",
    }


async def stream_text(system: str, messages: list[dict]) -> AsyncIterator[str]:
    """Yield text deltas. Raises LlmUnavailable on API failures or refusals."""
    if not is_configured():
        raise LlmUnavailable("ANTHROPIC_API_KEY not set")
    try:
        async with _get_client().beta.messages.stream(
            **_request_params(system, messages, CHAT_MAX_TOKENS)
        ) as stream:
            async for text in stream.text_stream:
                yield text
            final = await stream.get_final_message()
    except (RateLimitError, APIStatusError, APIConnectionError) as exc:
        logger.warning("Claude chat request failed: %s", type(exc).__name__)
        raise LlmUnavailable(str(exc)) from exc
    if final.stop_reason == "refusal":
        raise LlmUnavailable("refusal")


async def complete_text(system: str, prompt: str) -> str:
    """Single short answer. Raises LlmUnavailable on failure."""
    if not is_configured():
        raise LlmUnavailable("ANTHROPIC_API_KEY not set")
    try:
        response = await _get_client().beta.messages.create(
            **_request_params(system, [{"role": "user", "content": prompt}], COMMENTARY_MAX_TOKENS)
        )
    except (RateLimitError, APIStatusError, APIConnectionError) as exc:
        logger.warning("Claude commentary request failed: %s", type(exc).__name__)
        raise LlmUnavailable(str(exc)) from exc
    if response.stop_reason == "refusal":
        raise LlmUnavailable("refusal")
    return "".join(b.text for b in response.content if b.type == "text").strip()


class LlmUnavailable(Exception):
    pass
