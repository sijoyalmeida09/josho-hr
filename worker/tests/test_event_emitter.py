import pytest

from worker import event_emitter


def test_known_kinds_match_gate_taxonomy():
    # GATE-DATA-03 taxonomy — MUST stay in sync with docs/data-model.md.
    assert event_emitter.KINDS == (
        "form_field_filled",
        "dropdown_selected",
        "file_uploaded",
        "answer_generated",
        "submission_confirmed",
        "error",
    )


@pytest.mark.asyncio
async def test_emit_rejects_unknown_kind():
    with pytest.raises(ValueError):
        await event_emitter.emit("u", 1, "nonexistent", {})
