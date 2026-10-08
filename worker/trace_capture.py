"""
Playwright trace capture + Supabase Storage upload.

Usage:
    async with capture_trace(user_id, application_id) as page:
        await page.goto(...)
        await page.fill(...)
    # trace.zip has been uploaded to traces/{user_id}/{application_id}.zip

Respects MAX_TRACE_SIZE_MB from config/limits.py; traces larger than that are
discarded and an `error` event is emitted (GATE-REL-02 observability).
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from playwright.async_api import Page, async_playwright

from worker.config.limits import MAX_TRACE_SIZE_MB
from worker.event_emitter import emit
from worker.supa import supa

log = logging.getLogger(__name__)

GATE_ID = "GATE-REL-02"


@asynccontextmanager
async def capture_trace(
    user_id: str,
    application_id: int,
) -> AsyncIterator[Page]:
    headless = os.environ.get("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=headless)
        context = await browser.new_context()
        await context.tracing.start(screenshots=True, snapshots=True, sources=False)
        page = await context.new_page()
        try:
            yield page
        finally:
            with tempfile.TemporaryDirectory() as tmp:
                trace_path = Path(tmp) / "trace.zip"
                await context.tracing.stop(path=str(trace_path))
                await context.close()
                await browser.close()

                size_mb = trace_path.stat().st_size / 1024 / 1024
                if size_mb > MAX_TRACE_SIZE_MB:
                    log.warning(
                        "trace oversized (%.1f MB > %d) application_id=%s; discarding",
                        size_mb,
                        MAX_TRACE_SIZE_MB,
                        application_id,
                    )
                    await emit(
                        user_id,
                        application_id,
                        "error",
                        {
                            "stage": "trace_capture",
                            "message": f"trace oversized ({size_mb:.1f} MB)",
                            "retry": 0,
                        },
                    )
                    return

                remote = f"{user_id}/{application_id}.zip"
                data = trace_path.read_bytes()
                await asyncio.to_thread(
                    lambda: supa()
                    .storage.from_("traces")
                    .upload(
                        remote,
                        data,
                        {"content-type": "application/zip", "upsert": "true"},
                    )
                )
                await asyncio.to_thread(
                    lambda: supa()
                    .table("applications")
                    .update({"trace_storage_path": remote})
                    .eq("id", application_id)
                    .execute()
                )
                log.info(
                    "trace uploaded path=%s size_mb=%.2f",
                    remote,
                    size_mb,
                )
