import hmac
import json
from hashlib import sha256
from unittest.mock import patch

import httpx
import pytest
import respx

from worker import n8n_dispatcher


@pytest.mark.asyncio
async def test_unknown_event_raises():
    with pytest.raises(ValueError):
        await n8n_dispatcher.dispatch("u", "not_a_real_event", {})


@pytest.mark.asyncio
@respx.mock
async def test_hmac_signature_is_stable():
    url = "https://n8n.example.test/webhook/abc"
    secret = b"test-hmac-secret"

    async def _fake_integration(_user_id):
        return url, secret

    received: dict[str, str] = {}

    def _handler(request: httpx.Request):
        received["sig"] = request.headers["X-JoshoHR-Signature"]
        received["body"] = request.content.decode("utf-8")
        return httpx.Response(200, json={"ok": True})

    respx.post(url).mock(side_effect=_handler)

    with patch.object(n8n_dispatcher, "_load_integration", _fake_integration):
        with patch.object(n8n_dispatcher, "_flag_enabled", lambda: True):
            await n8n_dispatcher.dispatch("user-1", "application_submitted", {"x": 1})

    body = received["body"].encode("utf-8")
    expected = "sha256=" + hmac.new(secret, body, sha256).hexdigest()
    assert received["sig"] == expected
    assert json.loads(received["body"])["event"] == "application_submitted"


@pytest.mark.asyncio
@respx.mock
async def test_retry_then_deadletter(monkeypatch):
    url = "https://n8n.example.test/webhook/broken"
    secret = b"secret"

    async def _fake_integration(_uid):
        return url, secret

    respx.post(url).mock(return_value=httpx.Response(500, text="boom"))
    # remove the backoff so tests run fast
    monkeypatch.setattr(n8n_dispatcher, "_BACKOFF_SECONDS", (0.0, 0.0, 0.0))

    dead = {"called": False}

    async def _dl(*_a, **_k):
        dead["called"] = True

    with patch.object(n8n_dispatcher, "_load_integration", _fake_integration):
        with patch.object(n8n_dispatcher, "_flag_enabled", lambda: True):
            with patch.object(n8n_dispatcher, "_deadletter", _dl):
                ok = await n8n_dispatcher.dispatch("u", "application_submitted", {})

    assert ok is False
    assert dead["called"] is True
