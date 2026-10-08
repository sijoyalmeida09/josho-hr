"""
Wrap job_hunter_v2/deep_eval.py — return skill-gap recommendations.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from worker.adapters.tailor_wrapper import inject_user
from worker.user_context import UserContext

log = logging.getLogger(__name__)


async def evaluate(
    user_ctx: UserContext,
    job: dict[str, Any],
    tailored_resume: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Returns a list of {skill, action, priority} dicts suitable for
    applications.skill_gaps JSONB column.
    """
    try:
        from job_hunter_v2.deep_eval import deep_evaluate_fit  # type: ignore
    except ImportError:
        log.warning("deep_eval.deep_evaluate_fit not available")
        return []

    with inject_user(user_ctx):
        result = await asyncio.to_thread(deep_evaluate_fit, job, tailored_resume)

    if not isinstance(result, dict):
        return []

    gaps: list[dict[str, Any]] = []
    for g in result.get("gaps") or []:
        if not isinstance(g, dict):
            continue
        gaps.append(
            {
                "skill": str(g.get("skill") or g.get("name") or "unknown"),
                "action": str(g.get("action") or g.get("recommendation") or ""),
                "priority": str(g.get("priority") or "medium"),
            }
        )
    return gaps
