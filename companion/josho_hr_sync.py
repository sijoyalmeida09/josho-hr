#!/usr/bin/env python3
"""
josho_hr_sync.py — single-file local-sync companion for josho-hr.

Phase 2 capabilities:
  - `--init`          Create ~/josho-hr layout and save token
  - `--print-layout`  Show target folders, do nothing
  - `--sync`          One-shot: download manifest, pull new artifacts,
                      push PDFs dropped into inbox/, write applications.csv
  - `--watch`         Daemonize: run --sync every 60 seconds

Folder layout auto-created at ~/josho-hr/:
    resumes/       — downloaded copies of master resume + tailored variants
    cover_letters/ — downloaded cover letter text files
    traces/        — downloaded Playwright trace zips (large; retention 90d)
    inbox/         — drop PDFs here; companion uploads them on next sync
    applications.csv — rolling export of application metadata
    .josho-hr.json — local sync state (token + last-sync cursor)

Stdlib + `requests` only. No third-party SDKs.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

GATE_ID: Final = "GATE-INT-02"
DEFAULT_BASE_URL: Final = "https://josho-hr.vercel.app"
BASE_DIR: Final = Path(os.path.expanduser("~/josho-hr"))
CONFIG_PATH: Final = BASE_DIR / ".josho-hr.json"
SUBDIRS: Final[tuple[str, ...]] = ("resumes", "cover_letters", "traces", "inbox")


# ---------- config ---------------------------------------------------------

@dataclass
class Config:
    base_url: str
    token: str
    last_sync: str | None = None

    @classmethod
    def load(cls) -> "Config":
        env_token = os.environ.get("JOSHO_HR_TOKEN")
        env_base = os.environ.get("JOSHO_HR_BASE_URL")
        if CONFIG_PATH.exists():
            raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        else:
            raw = {}
        token = env_token or raw.get("token", "")
        base_url = env_base or raw.get("base_url") or DEFAULT_BASE_URL
        if not token:
            raise SystemExit(
                "No companion token found. Run `--init` or set JOSHO_HR_TOKEN."
            )
        return cls(base_url=base_url, token=token, last_sync=raw.get("last_sync"))

    def save(self) -> None:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(
            json.dumps(
                {
                    "base_url": self.base_url,
                    "token": self.token,
                    "last_sync": self.last_sync,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        try:
            os.chmod(CONFIG_PATH, 0o600)
        except OSError:
            pass


# ---------- layout ---------------------------------------------------------

def ensure_layout(base: Path = BASE_DIR) -> list[Path]:
    created: list[Path] = []
    base.mkdir(parents=True, exist_ok=True)
    for sub in SUBDIRS:
        p = base / sub
        if not p.exists():
            p.mkdir(parents=True, exist_ok=True)
            created.append(p)
    csv_path = base / "applications.csv"
    if not csv_path.exists():
        csv_path.write_text(
            "id,company,role,status,applied_at,resume_path,cover_letter_path\n",
            encoding="utf-8",
        )
        created.append(csv_path)
    return created


# ---------- HTTP helpers ---------------------------------------------------

def _request(
    method: str,
    cfg: Config,
    path: str,
    *,
    params: dict[str, str] | None = None,
    body: bytes | None = None,
    content_type: str | None = None,
) -> tuple[int, bytes]:
    url = urllib.parse.urljoin(cfg.base_url, path)
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    headers = {"Authorization": f"Bearer {cfg.token}", "User-Agent": "josho-hr-sync/0.2"}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except urllib.error.URLError as e:
        raise SystemExit(f"Network error calling {url}: {e.reason}") from e


def _download(url: str, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "josho-hr-sync/0.2"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        total = 0
        with dest.open("wb") as f:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                f.write(chunk)
                total += len(chunk)
    return total


# ---------- sync -----------------------------------------------------------

def _safe_slug(s: str | None) -> str:
    if not s:
        return "unknown"
    out = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in s)
    return out[:80] or "unknown"


def _pull_manifest(cfg: Config) -> dict[str, Any]:
    status, body = _request("GET", cfg, "/api/companion/manifest")
    if status != 200:
        raise SystemExit(f"manifest failed: HTTP {status} — {body[:300].decode(errors='replace')}")
    return json.loads(body.decode("utf-8"))


def _write_csv(manifest: dict[str, Any]) -> int:
    rows = manifest.get("applications", [])
    csv_path = BASE_DIR / "applications.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            ["id", "company", "role", "status", "applied_at", "created_at",
             "resume_downloaded", "cover_letter_downloaded", "trace_downloaded"]
        )
        for a in rows:
            w.writerow([
                a.get("id", ""),
                a.get("company", ""),
                a.get("role", ""),
                a.get("status", ""),
                a.get("applied_at", ""),
                a.get("created_at", ""),
                "yes" if a.get("resume_url") else "",
                "yes" if a.get("cover_letter_url") else "",
                "yes" if a.get("trace_url") else "",
            ])
    return len(rows)


def _pull_artifacts(manifest: dict[str, Any]) -> int:
    downloads = 0
    master = manifest.get("master_resume_url")
    if master:
        try:
            _download(master, BASE_DIR / "resumes" / "master.pdf")
            downloads += 1
        except Exception as e:  # noqa: BLE001
            print(f"  ! master resume download failed: {e}", file=sys.stderr)

    for a in manifest.get("applications", []):
        slug = f"{a.get('id')}_{_safe_slug(a.get('company'))}_{_safe_slug(a.get('role'))}"
        pairs = [
            (a.get("resume_url"), BASE_DIR / "resumes" / f"{slug}.pdf"),
            (a.get("cover_letter_url"), BASE_DIR / "cover_letters" / f"{slug}.txt"),
            (a.get("trace_url"), BASE_DIR / "traces" / f"{slug}.zip"),
        ]
        for url, dest in pairs:
            if not url or dest.exists():
                continue
            try:
                _download(url, dest)
                downloads += 1
            except Exception as e:  # noqa: BLE001
                print(f"  ! {dest.name} failed: {e}", file=sys.stderr)
    return downloads


def _push_inbox(cfg: Config) -> int:
    inbox = BASE_DIR / "inbox"
    pushed = 0
    for path in sorted(inbox.iterdir()) if inbox.exists() else []:
        if not path.is_file():
            continue
        data = path.read_bytes()
        status, body = _request(
            "POST",
            cfg,
            "/api/companion/upload",
            params={"bucket": "inbox", "name": path.name},
            body=data,
            content_type="application/pdf",
        )
        if status == 200:
            archive = BASE_DIR / "inbox" / ".synced"
            archive.mkdir(parents=True, exist_ok=True)
            path.rename(archive / path.name)
            pushed += 1
        else:
            print(
                f"  ! upload {path.name} failed: HTTP {status} — "
                f"{body[:200].decode(errors='replace')}",
                file=sys.stderr,
            )
    return pushed


def cmd_sync() -> int:
    ensure_layout()
    cfg = Config.load()
    print(f"→ sync against {cfg.base_url}")
    manifest = _pull_manifest(cfg)
    rows = _write_csv(manifest)
    downloaded = _pull_artifacts(manifest)
    pushed = _push_inbox(cfg)
    cfg.last_sync = manifest.get("generated_at")
    cfg.save()
    print(f"  applications: {rows} | downloaded: {downloaded} | uploaded: {pushed}")
    return 0


# ---------- commands -------------------------------------------------------

def cmd_print_layout() -> int:
    print(f"Would ensure the following under {BASE_DIR}:")
    for sub in SUBDIRS:
        print(f"  - {BASE_DIR / sub}")
    print(f"  - {BASE_DIR / 'applications.csv'}")
    print(f"  - {BASE_DIR / '.josho-hr.json'} (config; permissions 600)")
    return 0


def cmd_init(base_url: str, token: str | None) -> int:
    created = ensure_layout()
    print(f"Created {len(created)} paths under {BASE_DIR}.")
    for p in created:
        print(f"  - {p}")

    if not token:
        try:
            token = input("Paste your companion token (from Settings → Local sync): ").strip()
        except EOFError:
            token = ""
    if not token:
        print("No token provided. Set JOSHO_HR_TOKEN or rerun with --token=...", file=sys.stderr)
        return 2

    cfg = Config(base_url=base_url, token=token)
    cfg.save()
    print(f"Saved config to {CONFIG_PATH}")
    return 0


def cmd_watch(interval: int) -> int:
    while True:
        try:
            cmd_sync()
        except SystemExit as e:
            print(f"sync error: {e}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"unexpected error: {e}", file=sys.stderr)
        time.sleep(interval)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="josho-hr local-sync companion (Phase 2)."
    )
    parser.add_argument("--print-layout", action="store_true")
    parser.add_argument("--init", action="store_true")
    parser.add_argument("--sync", action="store_true")
    parser.add_argument("--watch", action="store_true")
    parser.add_argument("--base-url", default=os.environ.get("JOSHO_HR_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--token", default=None)
    parser.add_argument("--interval", type=int, default=60)
    args = parser.parse_args(argv)

    if args.print_layout:
        return cmd_print_layout()
    if args.init:
        return cmd_init(args.base_url, args.token)
    if args.watch:
        return cmd_watch(args.interval)
    if args.sync or not any([args.print_layout, args.init, args.watch]):
        return cmd_sync()
    return 0


if __name__ == "__main__":
    sys.exit(main())
