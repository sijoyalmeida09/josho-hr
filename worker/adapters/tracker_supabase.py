"""
Supabase-backed implementation of the tracker surface.

The original `job_hunter_v2/tracker_db.py` talks to a local SQLite file. We
do not modify it — this adapter replaces calls the pipeline makes against
a tracker object so that writes land in `public.applications` (user-scoped).

Only the methods the wrappers actually need are implemented.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from worker.supa import supa

log = logging.getLogger(__name__)


@dataclass
class TrackerSupabase:
    """Drop-in replacement for the tracker_db object expected by the pipeline."""

    user_id: str

    async def create_application(
        self,
        *,
        job: dict[str, Any],
        status: str = "queued",
        source: str | None = None,
    ) -> int:
        row = {
            "user_id": self.user_id,
            "company": job.get("company") or "unknown",
            "role": job.get("title") or job.get("role") or "unknown",
            "url": job.get("url"),
            "job_url": job.get("url"),
            "platform": job.get("platform"),
            "ats_platform": job.get("platform"),
            "location": job.get("location"),
            "status": status,
            "source": source or "manual",
            "job_snapshot": {
                "description": job.get("description") or "",
                "keywords": job.get("keywords") or [],
            },
        }
        res = await asyncio.to_thread(
            lambda: supa().table("applications").insert(row).execute()
        )
        app_id = int(res.data[0]["id"])
        log.info("created application_id=%d user=%s", app_id, self.user_id)
        return app_id

    async def update_status(
        self,
        application_id: int,
        status: str,
        extra: dict[str, Any] | None = None,
    ) -> None:
        from datetime import datetime, timezone

        patch: dict[str, Any] = {"status": status}
        if status == "submitted":
            patch["applied_at"] = datetime.now(timezone.utc).isoformat()
        if extra:
            patch.update(extra)
        await asyncio.to_thread(
            lambda: supa()
            .table("applications")
            .update(patch)
            .eq("id", application_id)
            .eq("user_id", self.user_id)
            .execute()
        )

    async def attach_resume(self, application_id: int, storage_path: str) -> None:
        await asyncio.to_thread(
            lambda: supa()
            .table("applications")
            .update({"resume_storage_path": storage_path})
            .eq("id", application_id)
            .eq("user_id", self.user_id)
            .execute()
        )

    async def attach_cover_letter(
        self,
        application_id: int,
        storage_path: str,
        text: str,
    ) -> None:
        await asyncio.to_thread(
            lambda: supa()
            .table("applications")
            .update(
                {
                    "cover_letter_storage_path": storage_path,
                    "cover_letter_text": text,
                }
            )
            .eq("id", application_id)
            .eq("user_id", self.user_id)
            .execute()
        )

    async def save_skill_gaps(
        self,
        application_id: int,
        gaps: list[dict[str, Any]],
    ) -> None:
        # Write to both the JSONB rollup on applications (cheap reads) AND
        # the normalized application_skill_gaps table (queryable).
        await asyncio.to_thread(
            lambda: supa()
            .table("applications")
            .update({"skill_gaps": gaps})
            .eq("id", application_id)
            .eq("user_id", self.user_id)
            .execute()
        )
        if not gaps:
            return
        _level_map = {
            "critical": "critical",
            "high": "required",
            "required": "required",
            "medium": "nice_to_have",
            "low": "nice_to_have",
            "nice_to_have": "nice_to_have",
        }
        rows = [
            {
                "user_id": self.user_id,
                "application_id": application_id,
                "missing_skill": g.get("skill") or "",
                "required_level": _level_map.get(
                    (g.get("priority") or "medium").lower(), "nice_to_have"
                ),
                "study_suggestion": g.get("action") or "",
                "priority": {"critical": 1, "required": 2, "nice_to_have": 3}.get(
                    _level_map.get(
                        (g.get("priority") or "medium").lower(), "nice_to_have"
                    ),
                    3,
                ),
            }
            for g in gaps
        ]
        await asyncio.to_thread(
            lambda: supa().table("application_skill_gaps").insert(rows).execute()
        )
