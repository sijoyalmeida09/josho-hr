"""
Thin, module-level Supabase client for the worker.

Uses the service_role key (RLS bypass). Every call MUST still filter by the
user_id the row belongs to — that is a policy requirement, not enforced here.
"""

from __future__ import annotations

import os
from functools import cache

from supabase import Client, create_client


@cache
def supa() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)
