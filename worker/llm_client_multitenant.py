"""
Multi-tenant LLM client.

Resolution order:
  1. BYOK providers in this order: groq → openrouter → anthropic → cerebras → mistral
  2. If user has use_trial_pool=true AND trial_calls_remaining > 0:
       use TRIAL_POOL_GROQ_KEY (env), then TRIAL_POOL_OPENROUTER_KEY
  3. Else: raise NoLlmKeyError — caller surfaces as an error event

Trial-pool calls decrement user_api_keys.trial_calls_remaining via the
decrement_trial_call RPC. BYOK calls do NOT decrement.

Failover: on a 5xx / timeout / rate-limit from the primary, fall through to
the next provider in the resolution list (same user).
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

from worker.supa import supa
from worker.user_context import UserContext

log = logging.getLogger(__name__)

GATE_ID = "GATE-SEC-01"


class NoLlmKeyError(RuntimeError):
    pass


class AllProvidersFailedError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderCall:
    name: str
    endpoint: str
    model: str
    is_trial: bool


_BYOK_PROVIDERS = (
    ("groq", "https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile"),
    ("openrouter", "https://openrouter.ai/api/v1/chat/completions", "anthropic/claude-3.5-haiku"),
    ("anthropic", "https://api.anthropic.com/v1/messages", "claude-3-5-sonnet-20241022"),
    ("cerebras", "https://api.cerebras.ai/v1/chat/completions", "llama3.3-70b"),
    ("mistral", "https://api.mistral.ai/v1/chat/completions", "mistral-large-latest"),
)


def _trial_providers() -> list[tuple[str, str, str, str]]:
    res: list[tuple[str, str, str, str]] = []
    for name, endpoint, model in (
        ("groq", "https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile"),
        ("openrouter", "https://openrouter.ai/api/v1/chat/completions", "anthropic/claude-3.5-haiku"),
    ):
        env_key = os.environ.get(f"TRIAL_POOL_{name.upper()}_KEY")
        if env_key:
            res.append((name, endpoint, model, env_key))
    return res


async def _decrement_trial(user_id: str, provider: str) -> None:
    try:
        client = supa()
        await asyncio.to_thread(
            lambda: client.rpc(
                "decrement_trial_call",
                {"p_user_id": user_id, "p_provider": provider},
            ).execute()
        )
    except Exception as e:  # noqa: BLE001
        log.warning("decrement_trial_call failed user=%s: %s", user_id, e)


async def _call_openai_compat(
    endpoint: str,
    key: str,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float,
    response_format: str | None,
) -> str:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        res.raise_for_status()
        data = res.json()
        return data["choices"][0]["message"]["content"]


async def _call_anthropic(
    endpoint: str,
    key: str,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float,
) -> str:
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    convo = [m for m in messages if m["role"] != "system"]
    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": convo,
    }
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            endpoint,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        res.raise_for_status()
        data = res.json()
        parts = data.get("content") or []
        for p in parts:
            if p.get("type") == "text":
                return p.get("text") or ""
        return ""


async def chat_completion(
    user_ctx: UserContext,
    prompt: str,
    max_tokens: int = 1000,
    temperature: float = 0.2,
    system: str | None = None,
    response_format: str | None = None,
) -> tuple[str, str]:
    """Returns (content, provider_name). Raises NoLlmKeyError or AllProvidersFailedError."""
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    attempts: list[tuple[str, str, str, str, bool]] = []
    for name, endpoint, model in _BYOK_PROVIDERS:
        key_val = getattr(user_ctx.keys, name)
        if key_val:
            attempts.append((name, endpoint, model, key_val, False))

    if not attempts and user_ctx.keys.use_trial_pool and user_ctx.keys.trial_calls_remaining > 0:
        for name, endpoint, model, key_val in _trial_providers():
            attempts.append((name, endpoint, model, key_val, True))

    if not attempts:
        raise NoLlmKeyError(
            "no API key available: user has no BYOK and either disabled trial pool or exhausted it"
        )

    last_err: str | None = None
    for name, endpoint, model, key_val, is_trial in attempts:
        try:
            if name == "anthropic":
                content = await _call_anthropic(
                    endpoint, key_val, model, messages, max_tokens, temperature
                )
            else:
                content = await _call_openai_compat(
                    endpoint,
                    key_val,
                    model,
                    messages,
                    max_tokens,
                    temperature,
                    response_format,
                )
            if is_trial:
                await _decrement_trial(user_ctx.user_id, name)
            if not content:
                raise RuntimeError(f"{name} returned empty content")
            return content, name
        except (httpx.HTTPError, RuntimeError, KeyError) as e:
            last_err = f"{name}: {e}"
            log.warning("llm provider failed, falling through: %s", last_err)
            continue

    raise AllProvidersFailedError(last_err or "all providers failed")
