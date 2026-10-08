"""
Per-user context loader.

Loads identity, brand, API keys, quota from Supabase in one round trip.
Decrypts stored keys in-process using worker.encryption. Never logs the
decrypted values.

Phase 3 implementation. Fields mirror the web-tier Profile + ApiKeys shapes.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from worker.encryption import decrypt_from_storage
from worker.supa import supa

log = logging.getLogger(__name__)

GATE_ID = "GATE-DATA-03"


@dataclass(frozen=True)
class Identity:
    full_name: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    location: str = ""
    website: str = ""


@dataclass
class BrandProfile:
    key: str = "auto"
    summary: str = ""
    experience: list[dict[str, Any]] = field(default_factory=list)
    projects: list[dict[str, Any]] = field(default_factory=list)
    education: list[dict[str, Any]] = field(default_factory=list)
    skills: dict[str, list[str]] = field(default_factory=dict)


@dataclass
class ApiKeys:
    groq: str | None = None
    openrouter: str | None = None
    anthropic: str | None = None
    cerebras: str | None = None
    mistral: str | None = None
    gmail_address: str | None = None
    gmail_app_pw: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    use_trial_pool: bool = True
    trial_calls_remaining: int = 0


@dataclass
class Quota:
    apps_since_sijoy_run: int = 0
    cycle_size: int = 20
    total_apps_contributed: int = 0


@dataclass
class UserContext:
    user_id: str
    identity: Identity
    brand: BrandProfile
    keys: ApiKeys
    quota: Quota
    is_sijoy_system: bool = False
    master_resume_path: str | None = None

    def known_identity_strings(self) -> set[str]:
        """
        Strings that identify this user and must not be learned as
        "generic" form answers.
        """
        values = {
            self.identity.full_name.lower(),
            (self.identity.full_name.split()[0] if self.identity.full_name else "").lower(),
            (self.identity.full_name.split()[-1] if self.identity.full_name else "").lower(),
            self.identity.email.lower(),
            self.identity.phone,
            self.identity.linkedin.lower(),
            self.identity.github.lower(),
            self.identity.website.lower(),
            self.identity.location.lower(),
        }
        return {v for v in values if v}


_PROVIDER_COLUMNS = (
    ("groq", "groq_key_encrypted"),
    ("openrouter", "openrouter_key_encrypted"),
    ("anthropic", "anthropic_key_encrypted"),
    ("cerebras", "cerebras_key_encrypted"),
    ("mistral", "mistral_key_encrypted"),
)


def _as_bytes(raw: Any) -> bytes | None:
    if raw is None:
        return None
    if isinstance(raw, (bytes, bytearray, memoryview)):
        return bytes(raw)
    if isinstance(raw, str):
        if raw.startswith("\\x"):
            return bytes.fromhex(raw[2:])
        try:
            return bytes.fromhex(raw)
        except ValueError:
            return None
    return None


def _try_decrypt(raw: Any) -> str | None:
    buf = _as_bytes(raw)
    if not buf:
        return None
    try:
        return decrypt_from_storage(buf)
    except Exception as e:  # noqa: BLE001
        log.warning("decrypt failed: %s", e)
        return None


async def load(user_id: str) -> UserContext:
    client = supa()

    profile_res, keys_res, quota_res = await asyncio.gather(
        asyncio.to_thread(
            lambda: client.table("profiles")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        ),
        asyncio.to_thread(
            lambda: client.table("user_api_keys")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        ),
        asyncio.to_thread(
            lambda: client.table("user_quota")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        ),
    )

    p = getattr(profile_res, "data", None) or {}
    k = getattr(keys_res, "data", None) or {}
    q = getattr(quota_res, "data", None) or {}

    structured = p.get("structured_data") or {}
    sid = (structured.get("identity") if isinstance(structured, dict) else None) or {}

    identity = Identity(
        full_name=p.get("full_name") or sid.get("full_name") or "",
        email=p.get("email") or sid.get("email") or "",
        phone=p.get("phone") or sid.get("phone") or "",
        linkedin=p.get("linkedin") or sid.get("linkedin") or "",
        github=p.get("github") or sid.get("github") or "",
        location=p.get("location") or sid.get("location") or "",
        website=sid.get("website") or "",
    )

    brand = BrandProfile(
        key=p.get("brand_preference") or "auto",
        summary=(structured.get("summary") if isinstance(structured, dict) else "") or "",
        experience=list(structured.get("experience") or []) if isinstance(structured, dict) else [],
        projects=list(structured.get("projects") or []) if isinstance(structured, dict) else [],
        education=list(structured.get("education") or []) if isinstance(structured, dict) else [],
        skills=dict(structured.get("skills") or {}) if isinstance(structured, dict) else {},
    )

    keys = ApiKeys(
        use_trial_pool=bool(k.get("use_trial_pool", True)),
        trial_calls_remaining=int(k.get("trial_calls_remaining", 0) or 0),
        gmail_address=k.get("gmail_address"),
        telegram_chat_id=k.get("telegram_chat_id"),
    )
    for name, col in _PROVIDER_COLUMNS:
        setattr(keys, name, _try_decrypt(k.get(col)))
    keys.gmail_app_pw = _try_decrypt(k.get("gmail_app_pw_encrypted"))
    keys.telegram_bot_token = _try_decrypt(k.get("telegram_bot_token_encrypted"))

    quota = Quota(
        apps_since_sijoy_run=int(q.get("apps_since_sijoy_run", 0) or 0),
        cycle_size=int(q.get("cycle_size", 20) or 20),
        total_apps_contributed=int(q.get("total_apps_contributed", 0) or 0),
    )

    return UserContext(
        user_id=user_id,
        identity=identity,
        brand=brand,
        keys=keys,
        quota=quota,
        is_sijoy_system=bool(p.get("is_sijoy_system", False)),
        master_resume_path=p.get("master_resume_path"),
    )
