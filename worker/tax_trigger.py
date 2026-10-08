"""
Sijoy-tax trigger — SINGLE enforcement chokepoint.

Rules (plan section 4):
  - Only trial-pool users (user_api_keys.use_trial_pool = true) are subject.
  - On every successful user application, call on_user_application_success.
  - When bump_application_counter returns a value divisible by cycle_size
    (default 20), enqueue a Sijoy-tax job via the enqueue_sijoy_run RPC.
  - BYOK users skip entirely.

Do NOT duplicate the counter logic anywhere else.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from worker.supa import supa

log = logging.getLogger(__name__)

GATE_ID = "GATE-REL-01"
DEFAULT_CYCLE = 20


def _flag_enabled(name: str) -> bool:
    return os.environ.get(name, "true").lower() == "true"


async def on_user_application_success(
    user_id: str,
    contributor_application_id: int | None,
) -> dict[str, Any]:
    """
    Returns {
      "eligible": bool,      # was the user subject to tax this run?
      "counter": int,        # new apps_since_sijoy_run
      "tax_enqueued": bool,  # did we fire a Sijoy run?
      "sijoy_job_run_id": int | None
    }
    """
    client = supa()

    keys_row = await asyncio.to_thread(
        lambda: client.table("user_api_keys")
        .select("use_trial_pool")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    use_trial_pool = True
    if keys_row and getattr(keys_row, "data", None) is not None:
        use_trial_pool = bool(keys_row.data.get("use_trial_pool", True))

    if not use_trial_pool:
        return {"eligible": False, "counter": 0, "tax_enqueued": False, "sijoy_job_run_id": None}

    quota_row = await asyncio.to_thread(
        lambda: client.table("user_quota")
        .select("cycle_size")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    cycle_size = DEFAULT_CYCLE
    if quota_row and getattr(quota_row, "data", None) is not None:
        cycle_size = int(quota_row.data.get("cycle_size") or DEFAULT_CYCLE)

    bump = await asyncio.to_thread(
        lambda: client.rpc("bump_application_counter", {"p_user_id": user_id}).execute()
    )
    new_counter = int(getattr(bump, "data", 0) or 0)

    if new_counter % cycle_size != 0:
        return {
            "eligible": True,
            "counter": new_counter,
            "tax_enqueued": False,
            "sijoy_job_run_id": None,
        }

    if not _flag_enabled("FEATURE_SIJOY_TAX_ENABLED"):
        log.info("sijoy tax disabled by flag; skipping enqueue for user %s", user_id)
        return {
            "eligible": True,
            "counter": new_counter,
            "tax_enqueued": False,
            "sijoy_job_run_id": None,
        }

    enqueue = await asyncio.to_thread(
        lambda: client.rpc(
            "enqueue_sijoy_run",
            {
                "p_contributor_user_id": user_id,
                "p_contributor_app_id": contributor_application_id,
            },
        ).execute()
    )
    sijoy_job_run_id = getattr(enqueue, "data", None)
    log.info(
        "sijoy tax enqueued contributor=%s sijoy_job_id=%s counter=%d",
        user_id,
        sijoy_job_run_id,
        new_counter,
    )

    return {
        "eligible": True,
        "counter": new_counter,
        "tax_enqueued": True,
        "sijoy_job_run_id": sijoy_job_run_id,
    }
