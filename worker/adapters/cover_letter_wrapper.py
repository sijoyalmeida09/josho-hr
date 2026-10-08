"""
Wrap job_hunter_v2/cover_letter.py — generate + upload to Supabase Storage.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from worker.adapters.tailor_wrapper import inject_user
from worker.supa import supa
from worker.user_context import UserContext

log = logging.getLogger(__name__)


async def generate_and_upload(
    user_ctx: UserContext,
    application_id: int,
    job: dict[str, Any],
    tailored_resume: dict[str, Any],
) -> tuple[str, str]:
    """Returns (storage_path, text)."""
    from job_hunter_v2.cover_letter import generate_cover_letter  # type: ignore

    with inject_user(user_ctx):
        text = await asyncio.to_thread(generate_cover_letter, job, tailored_resume)

    if not text:
        raise RuntimeError("cover_letter.generate_cover_letter returned empty")

    storage_path = f"{user_ctx.user_id}/{application_id}.txt"
    data = text.encode("utf-8")
    await asyncio.to_thread(
        lambda: supa()
        .storage.from_("cover_letters")
        .upload(
            storage_path,
            data,
            {"content-type": "text/plain", "upsert": "true"},
        )
    )
    return storage_path, text
