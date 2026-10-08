"""
Wrap job_hunter_v2/resume_builder_v2.py — build PDF, upload to Supabase Storage.
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Any

from worker.adapters.tailor_wrapper import inject_user
from worker.supa import supa
from worker.user_context import UserContext

log = logging.getLogger(__name__)


async def build_and_upload(
    user_ctx: UserContext,
    application_id: int,
    job: dict[str, Any],
    tailored: dict[str, Any],
) -> str:
    """Returns Supabase Storage path of the uploaded PDF."""
    from job_hunter_v2.resume_builder_v2 import build_resume_v2  # type: ignore

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with inject_user(user_ctx):
            result = await asyncio.to_thread(
                build_resume_v2, job, tailored, tmp_path
            )

        pdf_path = getattr(result, "pdf_path", None) or (tmp_path / "resume.pdf")
        if not Path(pdf_path).exists():
            raise RuntimeError(f"build_resume_v2 produced no pdf at {pdf_path}")

        storage_path = f"{user_ctx.user_id}/{application_id}.pdf"
        data = Path(pdf_path).read_bytes()
        await asyncio.to_thread(
            lambda: supa()
            .storage.from_("resumes")
            .upload(
                storage_path,
                data,
                {"content-type": "application/pdf", "upsert": "true"},
            )
        )
        return storage_path
