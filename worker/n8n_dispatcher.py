"""
Outbound n8n webhook dispatcher.

Contract (GATE-INT-01, contractVersion="v1").

Headers:
    X-JoshoHR-Contract:   v1
    X-JoshoHR-Signature:  sha256=<hex-hmac over body>
    Idempotency-Key:      <uuid4>
    Content-Type:         application/json

Body:
    {
      "event": <event_type>,
      "occurred_at": <ISO 8601>,
      "data": { ... }
    }

Retry: 3 attempts, exponential backoff 1s / 4s / 16s.
DLQ: job_runs.kind='email_scan', status='dead_letter', metrics.original_event.
"""

from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Final

import httpx

from worker.encryption import decrypt_from_storage
from worker.supa import supa

log = logging.getLogger(__name__)

GATE_ID = "GATE-INT-01"
CONTRACT_VERSION: Final = "v1"

EVENT_TYPES: Final[tuple[str, ...]] = (
    "application_submitted",
    "application_failed",
    "email_received",
    "interview_invite",
    "rejection_received",
    "offer_received",
    "sijoy_contribution_made",
)

_BACKOFF_SECONDS = (1.0, 4.0)
_TIMEOUT_SECONDS = 10.0


def _flag_enabled() -> bool:
    return os.environ.get("FEATURE_N8N_OUTBOUND_ENABLED", "true").lower() == "true"


async def _load_integration(user_id: str) -> tuple[str, bytes] | None:
    client = supa()
    res = await asyncio.to_thread(
        lambda: client.table("user_integrations")
        .select("webhook_url, hmac_secret_encrypted, enabled, events")
        .eq("user_id", user_id)
        .eq("kind", "n8n_outbound")
        .eq("enabled", True)
        .maybe_single()
        .execute()
    )
    data = getattr(res, "data", None)
    if not data or not data.get("webhook_url") or not data.get("hmac_secret_encrypted"):
        return None

    secret_hex = data["hmac_secret_encrypted"]
    if isinstance(secret_hex, str) and secret_hex.startswith("\\x"):
        secret_bytes = bytes.fromhex(secret_hex[2:])
    elif isinstance(secret_hex, (bytes, bytearray, memoryview)):
        secret_bytes = bytes(secret_hex)
    else:
        secret_bytes = bytes.fromhex(secret_hex)
    secret = decrypt_from_storage(secret_bytes).encode("utf-8")
    return data["webhook_url"], secret


def _sign(secret: bytes, body: bytes) -> str:
    mac = hmac.new(secret, body, sha256).hexdigest()
    return f"sha256={mac}"


async def _deadletter(user_id: str, event: str, data: dict[str, Any], error: str) -> None:
    client = supa()
    await asyncio.to_thread(
        lambda: client.table("job_runs")
        .insert(
            {
                "user_id": user_id,
                "kind": "email_scan",
                "status": "dead_letter",
                "error_msg": error[:500],
                "metrics": {"original_event": event, "payload": data},
            }
        )
        .execute()
    )


async def dispatch(
    user_id: str,
    event: str,
    data: dict[str, Any],
) -> bool:
    if event not in EVENT_TYPES:
        raise ValueError(f"unknown n8n event {event!r}; must be one of {EVENT_TYPES}")
    if not _flag_enabled():
        log.info("n8n outbound disabled by flag; skipping event=%s user=%s", event, user_id)
        return True

    integration = await _load_integration(user_id)
    if integration is None:
        return True  # user has no n8n configured — success by omission
    url, secret = integration

    body = json.dumps(
        {
            "event": event,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "data": data,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")

    idem = str(uuid.uuid4())
    headers = {
        "Content-Type": "application/json",
        "X-JoshoHR-Contract": CONTRACT_VERSION,
        "X-JoshoHR-Signature": _sign(secret, body),
        "Idempotency-Key": idem,
        "User-Agent": "josho-hr-worker/0.3",
    }

    last_err = ""
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        for attempt_idx, delay in enumerate((0.0, *_BACKOFF_SECONDS)):
            if delay:
                await asyncio.sleep(delay)
            try:
                res = await client.post(url, content=body, headers=headers)
                if 200 <= res.status_code < 300:
                    log.info("n8n delivered event=%s attempt=%d", event, attempt_idx + 1)
                    return True
                last_err = f"HTTP {res.status_code}: {res.text[:200]}"
            except httpx.HTTPError as e:
                last_err = f"{type(e).__name__}: {e}"
            log.warning("n8n attempt %d failed event=%s: %s", attempt_idx + 1, event, last_err)

    await _deadletter(user_id, event, data, last_err)
    log.error("n8n dead-lettered event=%s user=%s error=%s", event, user_id, last_err)
    return False
