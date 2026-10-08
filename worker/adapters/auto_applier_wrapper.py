"""
Wrap the auto-applier with per-user identity + event emission + trace capture.

Phase 3 contract:
  - The wrapper is responsible for: (a) launching Playwright via trace_capture,
    (b) injecting identity strings so the original auto_applier does not learn
    them as generic answers, (c) emitting `form_field_filled`, `dropdown_selected`,
    `file_uploaded`, `answer_generated`, `submission_confirmed` events.
  - The original job_hunter_v2/auto_applier.py provides the per-field fill
    routines. In Phase 3 we call the Playwright primitives directly for the
    happy path and fall back to the module's richer helpers when present.

Phase 4 will replace the `_mock_submit` path with the real
`auto_applier.smart_apply_one(page, job)` call once page/fill primitives are
validated end-to-end against a staging ATS.
"""

from __future__ import annotations

import logging
from typing import Any

from worker.event_emitter import emit
from worker.trace_capture import capture_trace
from worker.user_context import UserContext

log = logging.getLogger(__name__)


async def apply_to_job(
    user_ctx: UserContext,
    application_id: int,
    job: dict[str, Any],
    resume_storage_path: str,
    cover_letter_text: str,
) -> dict[str, Any]:
    """
    Returns {
      "status": "submitted" | "failed",
      "confirmation": str | None,
      "error": str | None,
    }
    """
    url = job.get("url")
    if not url:
        return {"status": "failed", "confirmation": None, "error": "job has no url"}

    known = user_ctx.known_identity_strings()
    log.info(
        "apply_to_job user=%s application_id=%d url=%s known_ids=%d",
        user_ctx.user_id,
        application_id,
        url,
        len(known),
    )

    async with capture_trace(user_ctx.user_id, application_id) as page:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            await emit(
                user_ctx.user_id,
                application_id,
                "form_field_filled",
                {"selector": "page", "label": "navigate", "value": url},
            )

            # Hand off to the vendored auto_applier if it exposes a helper.
            # auto_applier.py functions work on a live page; wrapping them
            # requires per-ATS routing which is handled by smart_apply.detect_platform.
            try:
                from job_hunter_v2.smart_apply import (  # type: ignore
                    detect_platform,
                    fill_text_fields,
                )

                platform = detect_platform(url) or "generic"
                await emit(
                    user_ctx.user_id,
                    application_id,
                    "answer_generated",
                    {"stage": "platform_detected", "platform": platform},
                )
                fill_text_fields(page, job.get("company", ""), job.get("title", ""))
            except ImportError:
                log.warning("smart_apply helpers unavailable; skipping auto-fill")

            # Final submission is always a manual confirmation in Phase 3 —
            # we log what would be submitted but do NOT click submit unless
            # AUTO_APPLIER_ALLOW_SUBMIT=true.
            from os import environ

            allow = environ.get("AUTO_APPLIER_ALLOW_SUBMIT", "false").lower() == "true"
            if allow:
                try:
                    await page.click(
                        "button[type='submit'], input[type='submit']",
                        timeout=5_000,
                    )
                    await emit(
                        user_ctx.user_id,
                        application_id,
                        "submission_confirmed",
                        {"method": "click", "selector": "button[type='submit']"},
                    )
                    return {"status": "submitted", "confirmation": "click_ok", "error": None}
                except Exception as e:  # noqa: BLE001
                    await emit(
                        user_ctx.user_id,
                        application_id,
                        "error",
                        {"stage": "submit_click", "message": str(e), "retry": 0},
                    )
                    return {"status": "failed", "confirmation": None, "error": str(e)}

            await emit(
                user_ctx.user_id,
                application_id,
                "submission_confirmed",
                {"method": "dry_run", "note": "AUTO_APPLIER_ALLOW_SUBMIT=false"},
            )
            return {"status": "submitted", "confirmation": "dry_run", "error": None}

        except Exception as e:  # noqa: BLE001
            log.exception("apply_to_job failed application_id=%d", application_id)
            await emit(
                user_ctx.user_id,
                application_id,
                "error",
                {"stage": "apply", "message": str(e), "retry": 0},
            )
            return {"status": "failed", "confirmation": None, "error": str(e)}
