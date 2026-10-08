"""
Wrap job_hunter_v2/resume_tailor.py with per-user identity + brand.

We do not edit resume_tailor.py. Instead, we temporarily monkey-patch the
module-level globals (IDENTITY, EDUCATION, PROJECTS, SKILLS, get_brand)
inside a contextmanager, call tailor_resume(), then restore.

This is the only safe way to reuse the existing logic from a multi-tenant
worker without violating the core-lock contract.
"""

from __future__ import annotations

import contextlib
import logging
from typing import Any, Iterator

from worker.user_context import UserContext

log = logging.getLogger(__name__)


def _brand_from_ctx(user_ctx: UserContext, original_brand_cls):
    """Build a BrandProfile-ish object using the user's structured data."""
    b = user_ctx.brand
    skills = b.skills or {}
    if isinstance(skills, list):
        skills = {"Technical": list(skills)}
    return original_brand_cls(
        key=b.key or "auto",
        summary_template=(b.summary or "").replace("{company}", "{{company}}"),
        experience=list(b.experience),
        skills_order=list(skills.keys()),
    )


@contextlib.contextmanager
def inject_user(user_ctx: UserContext) -> Iterator[None]:
    import sys

    jh_resume_data = sys.modules.get("job_hunter_v2.resume_data") or __import__(
        "job_hunter_v2.resume_data", fromlist=["*"]
    )
    jh_resume_tailor = sys.modules.get("job_hunter_v2.resume_tailor") or __import__(
        "job_hunter_v2.resume_tailor", fromlist=["*"]
    )

    prev: dict[str, Any] = {}
    patch: dict[str, Any] = {
        "IDENTITY": jh_resume_data.Identity(
            name=user_ctx.identity.full_name or "Applicant",
            phone=user_ctx.identity.phone or "",
            email=user_ctx.identity.email or "",
            website=user_ctx.identity.website or "",
            linkedin=user_ctx.identity.linkedin or "",
            github=user_ctx.identity.github or "",
            location_us=user_ctx.identity.location or "",
            location_in=user_ctx.identity.location or "",
            visa="",
        ),
        "EDUCATION": list(user_ctx.brand.education)
        if user_ctx.brand.education
        else list(getattr(jh_resume_data, "EDUCATION", [])),
        "PROJECTS": list(user_ctx.brand.projects)
        if user_ctx.brand.projects
        else list(getattr(jh_resume_data, "PROJECTS", [])),
        "SKILLS": dict(user_ctx.brand.skills)
        if user_ctx.brand.skills
        else dict(getattr(jh_resume_data, "SKILLS", {})),
    }

    def patched_get_brand(_key: str):
        return _brand_from_ctx(user_ctx, jh_resume_data.BrandProfile)

    for mod in (jh_resume_data, jh_resume_tailor):
        for name, value in patch.items():
            if hasattr(mod, name):
                prev[f"{mod.__name__}.{name}"] = getattr(mod, name)
                setattr(mod, name, value)
        if hasattr(mod, "get_brand"):
            prev[f"{mod.__name__}.get_brand"] = mod.get_brand
            mod.get_brand = patched_get_brand  # type: ignore[attr-defined]

    try:
        yield
    finally:
        for fullname, value in prev.items():
            module_name, attr = fullname.rsplit(".", 1)
            mod = sys.modules[module_name]
            setattr(mod, attr, value)


def tailor_for_user(user_ctx: UserContext, job: dict[str, Any]) -> dict[str, Any]:
    """Returns the tailored-resume dict produced by job_hunter_v2.resume_tailor."""
    from job_hunter_v2.niche_router import classify
    from job_hunter_v2.resume_tailor import tailor_resume

    classification = classify(job)
    with inject_user(user_ctx):
        tailored = tailor_resume(job, classification)
    return tailored
