"""
Structured event emission into public.application_events.

GATE-DATA-03: Event taxonomy v1. The KINDS tuple below MUST match the
`## Event taxonomy v1` section of josho-hr/docs/data-model.md exactly.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Final

from worker.supa import supa

log = logging.getLogger(__name__)

GATE_ID = "GATE-DATA-03"
EVENT_TAXONOMY_VERSION: Final = "v1"

KINDS: Final[tuple[str, ...]] = (
    "form_field_filled",
    "dropdown_selected",
    "file_uploaded",
    "answer_generated",
    "submission_confirmed",
    "error",
)


async def emit(
    user_id: str,
    application_id: int,
    kind: str,
    payload: dict[str, Any],
) -> None:
    if kind not in KINDS:
        raise ValueError(f"unknown event kind {kind!r}; must be one of {KINDS}")
    row = {
        "user_id": user_id,
        "application_id": application_id,
        "kind": kind,
        "payload": payload,
    }
    # supabase-py is sync; run in thread to avoid blocking the event loop.
    await asyncio.to_thread(lambda: supa().table("application_events").insert(row).execute())
    log.info("event emitted application_id=%s kind=%s", application_id, kind)
