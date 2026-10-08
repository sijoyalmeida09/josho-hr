"""
GATE-COST-01: free-tier guardrails.

Values here MUST match the `## Env defaults` section of josho-hr/docs/limits.md.
A diff script `python -m worker.config.limits --print` outputs the table below
so docs/limits.md can be mechanically verified.
"""

from __future__ import annotations

import json
import sys

# Per-user limits ------------------------------------------------------------
MAX_APPS_PER_USER_PER_DAY: int = 100
MAX_TRACE_SIZE_MB: int = 10
MAX_RESUME_VERSIONS: int = 25
MAX_EVENTS_PER_APP: int = 500

# Global circuit breakers ----------------------------------------------------
STORAGE_WARNING_PCT: int = 80
STORAGE_HARDSTOP_PCT: int = 100
WORKER_MAX_CONCURRENT_PLAYWRIGHT_SESSIONS: int = 3

# Retention (also referenced by GATE-COST-02) --------------------------------
TRACE_RETENTION_DAYS: int = 90
EMAIL_RETENTION_DAYS: int = 365
DELETED_ACCOUNT_PURGE_HOURS: int = 24


def to_dict() -> dict[str, int]:
    """Return all public constants so docs can diff against runtime values."""
    g = globals()
    return {
        k: v
        for k, v in g.items()
        if k.isupper() and isinstance(v, int)
    }


def main() -> int:
    print(json.dumps(to_dict(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
