"""
End-to-end apply pipeline for a single job_runs row.

Steps (matches plan section 1.3):
  1. Load user context
  2. Create/reuse application row
  3. Tailor resume
  4. Build + upload PDF
  5. Generate + upload cover letter
  6. Skill-gap eval
  7. Auto-apply via Playwright (with trace capture)
  8. If submitted, update status + run tax trigger
  9. Dispatch n8n event
"""

from __future__ import annotations

import logging
from typing import Any

import worker.user_context as ctx_mod
from worker.adapters.auto_applier_wrapper import apply_to_job
from worker.adapters.cover_letter_wrapper import generate_and_upload as build_cover
from worker.adapters.resume_build_wrapper import build_and_upload as build_resume
from worker.adapters.skill_gap_wrapper import evaluate as skill_gap_eval
from worker.adapters.tailor_wrapper import tailor_for_user
from worker.adapters.tracker_supabase import TrackerSupabase
from worker.event_emitter import emit
from worker.n8n_dispatcher import dispatch as n8n_dispatch
from worker.tax_trigger import on_user_application_success

log = logging.getLogger(__name__)


async def run_apply(job_run: dict[str, Any]) -> dict[str, Any]:
    user_id = job_run["user_id"]
    params = job_run.get("params") or {}
    job = params.get("job") or {}
    existing_app_id: int | None = params.get("application_id")

    user_ctx = await ctx_mod.load(user_id)
    tracker = TrackerSupabase(user_id=user_id)

    if existing_app_id is None:
        application_id = await tracker.create_application(job=job, status="running")
    else:
        application_id = existing_app_id
        await tracker.update_status(application_id, "running")

    try:
        tailored = tailor_for_user(user_ctx, job)
        await emit(
            user_id,
            application_id,
            "answer_generated",
            {
                "stage": "tailor",
                "keywords_matched": tailored.get("keywords_matched", []),
            },
        )

        resume_path = await build_resume(user_ctx, application_id, job, tailored)
        await tracker.attach_resume(application_id, resume_path)
        await emit(
            user_id,
            application_id,
            "file_uploaded",
            {"bucket": "resumes", "path": resume_path},
        )

        cover_path, cover_text = await build_cover(user_ctx, application_id, job, tailored)
        await tracker.attach_cover_letter(application_id, cover_path, cover_text)
        await emit(
            user_id,
            application_id,
            "file_uploaded",
            {"bucket": "cover_letters", "path": cover_path},
        )

        gaps = await skill_gap_eval(user_ctx, job, tailored)
        if gaps:
            await tracker.save_skill_gaps(application_id, gaps)

        outcome = await apply_to_job(
            user_ctx,
            application_id,
            job,
            resume_storage_path=resume_path,
            cover_letter_text=cover_text,
        )

        final_status = "submitted" if outcome["status"] == "submitted" else "failed"
        await tracker.update_status(
            application_id,
            final_status,
            extra={"confirmation": outcome.get("confirmation")},
        )

        tax: dict[str, Any] = {"eligible": False, "tax_enqueued": False}
        if final_status == "submitted" and not job_run.get("is_sijoy_tax", False):
            tax = await on_user_application_success(user_id, application_id)

        event_name = (
            "application_submitted" if final_status == "submitted" else "application_failed"
        )
        await n8n_dispatch(
            user_id,
            event_name,
            {
                "application_id": application_id,
                "company": job.get("company"),
                "role": job.get("title") or job.get("role"),
                "confirmation": outcome.get("confirmation"),
                "error": outcome.get("error"),
            },
        )
        if tax.get("tax_enqueued"):
            await n8n_dispatch(
                user_id,
                "sijoy_contribution_made",
                {"counter": tax.get("counter"), "sijoy_job_run_id": tax.get("sijoy_job_run_id")},
            )

        return {
            "application_id": application_id,
            "status": final_status,
            "tax": tax,
        }

    except Exception as e:  # noqa: BLE001
        log.exception("run_apply failed application_id=%s", existing_app_id)
        await tracker.update_status(application_id, "failed")
        await emit(
            user_id,
            application_id,
            "error",
            {"stage": "pipeline", "message": str(e), "retry": 0},
        )
        raise
