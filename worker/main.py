"""
josho-hr worker entrypoint.

Runs three coroutines concurrently:
  1. Queue consumer — polls claim_next_job RPC, runs pipeline.run_apply.
  2. Health HTTP server on :8080 — Fly.io liveness probe.
  3. Signal handler — graceful SIGTERM shutdown.

Environment:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — required
    ENCRYPTION_KEY                           — 32 bytes base64
    WORKER_ID                                — defaults to hostname
    POLL_INTERVAL_SECONDS                    — defaults to 5
    LEASE_SECONDS                            — defaults to 900
    TRIAL_POOL_GROQ_KEY, TRIAL_POOL_OPENROUTER_KEY — optional
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import socket
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

from worker.pipeline import run_apply
from worker.supa import supa

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("worker")

_shutdown = asyncio.Event()


class _Health(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path not in ("/health", "/"):
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        body = b'{"ok":true,"service":"josho-hr-worker"}'
        self.wfile.write(body)

    def log_message(self, *_a: object, **_k: object) -> None:  # silence stderr spam
        return


async def _health_server() -> None:
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), _Health)
    log.info("health server listening on :%d", port)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, server.serve_forever)


async def _handle_job(job_run: dict) -> None:
    kind = job_run.get("kind")
    job_id = job_run["id"]
    log.info("handling job id=%d kind=%s user=%s", job_id, kind, job_run["user_id"])

    try:
        if kind == "apply":
            metrics = await run_apply(job_run)
        else:
            log.warning("unknown kind=%s; marking done with no-op", kind)
            metrics = {"noop": True}

        await asyncio.to_thread(
            lambda: supa()
            .rpc(
                "complete_job",
                {
                    "p_job_id": job_id,
                    "p_status": "done",
                    "p_error": None,
                    "p_metrics": metrics,
                },
            )
            .execute()
        )
        log.info("job done id=%d", job_id)

    except Exception as e:  # noqa: BLE001
        log.exception("job failed id=%d", job_id)
        attempt = int(job_run.get("attempt", 0))
        status = "dead_letter" if attempt >= 2 else "error"
        await asyncio.to_thread(
            lambda: supa()
            .rpc(
                "complete_job",
                {
                    "p_job_id": job_id,
                    "p_status": status,
                    "p_error": str(e)[:500],
                    "p_metrics": {"attempt": attempt},
                },
            )
            .execute()
        )


async def _consumer() -> None:
    worker_id = os.environ.get("WORKER_ID") or socket.gethostname()
    interval = float(os.environ.get("POLL_INTERVAL_SECONDS", "5"))
    lease = int(os.environ.get("LEASE_SECONDS", "900"))
    log.info("consumer started worker_id=%s poll=%.1fs lease=%ds", worker_id, interval, lease)

    client = supa()
    while not _shutdown.is_set():
        try:
            res = await asyncio.to_thread(
                lambda: client.rpc(
                    "claim_next_job",
                    {"p_worker_id": worker_id, "p_lease_seconds": lease},
                ).execute()
            )
            row = getattr(res, "data", None)
            if row:
                await _handle_job(row)
            else:
                await asyncio.sleep(interval)
        except Exception as e:  # noqa: BLE001
            log.exception("consumer loop error: %s", e)
            await asyncio.sleep(interval * 2)


def _install_signal_handlers(loop: asyncio.AbstractEventLoop) -> None:
    def _stop(*_a: object) -> None:
        log.info("shutdown signal received")
        loop.call_soon_threadsafe(_shutdown.set)

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            signal.signal(sig, _stop)
        except (ValueError, OSError):
            pass


async def main() -> int:
    loop = asyncio.get_running_loop()
    _install_signal_handlers(loop)
    await asyncio.gather(_consumer(), _health_server())
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
