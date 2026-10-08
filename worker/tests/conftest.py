import base64
import os

import pytest


@pytest.fixture(autouse=True)
def _env():
    os.environ.setdefault(
        "ENCRYPTION_KEY", base64.b64encode(b"\x01" * 32).decode("ascii")
    )
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    yield
