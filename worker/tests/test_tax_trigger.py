from unittest.mock import patch

import pytest

from worker import tax_trigger


class _Res:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, rows_map, rpc_map):
        self._rows = rows_map
        self._rpc = rpc_map
        self._ctx = {}

    def table(self, name):
        self._ctx["table"] = name
        return self

    def select(self, *_a, **_k):
        return self

    def eq(self, k, v):
        self._ctx[k] = v
        return self

    def maybe_single(self):
        return self

    def execute(self):
        t = self._ctx.get("table")
        return _Res(self._rows.get(t))

    def rpc(self, name, _params):
        return _RpcExec(self._rpc.get(name))


class _RpcExec:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return _Res(self._data)


@pytest.mark.asyncio
async def test_byok_user_is_exempt():
    fake = _FakeQuery(
        rows_map={
            "user_api_keys": {"use_trial_pool": False},
            "user_quota": {"cycle_size": 20},
        },
        rpc_map={"bump_application_counter": 99, "enqueue_sijoy_run": 500},
    )
    with patch.object(tax_trigger, "supa", lambda: fake):
        out = await tax_trigger.on_user_application_success("u", 1)
    assert out["eligible"] is False
    assert out["tax_enqueued"] is False


@pytest.mark.asyncio
async def test_trial_user_fires_on_cycle():
    fake = _FakeQuery(
        rows_map={
            "user_api_keys": {"use_trial_pool": True},
            "user_quota": {"cycle_size": 20},
        },
        rpc_map={"bump_application_counter": 20, "enqueue_sijoy_run": 500},
    )
    with patch.object(tax_trigger, "supa", lambda: fake):
        out = await tax_trigger.on_user_application_success("u", 42)
    assert out["eligible"] is True
    assert out["counter"] == 20
    assert out["tax_enqueued"] is True
    assert out["sijoy_job_run_id"] == 500


@pytest.mark.asyncio
async def test_trial_user_no_fire_off_cycle():
    fake = _FakeQuery(
        rows_map={
            "user_api_keys": {"use_trial_pool": True},
            "user_quota": {"cycle_size": 20},
        },
        rpc_map={"bump_application_counter": 7, "enqueue_sijoy_run": 500},
    )
    with patch.object(tax_trigger, "supa", lambda: fake):
        out = await tax_trigger.on_user_application_success("u", 1)
    assert out["eligible"] is True
    assert out["counter"] == 7
    assert out["tax_enqueued"] is False
