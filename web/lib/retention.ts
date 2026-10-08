/**
 * Retention horizons — GATE-LEGAL-02.
 *
 * These constants MUST match:
 *   docs/retention.md "## Retention schedule"
 *   worker/config/limits.py TRACE_RETENTION_DAYS / EMAIL_BODY_RETENTION_DAYS
 *
 * Changing a horizon requires: legal sign-off, migration backfill plan,
 * and privacy-notice diff in the launch packet.
 */

export const TRACE_RETENTION_DAYS = 90;
export const EMAIL_BODY_RETENTION_DAYS = 30;
export const EVENT_TIMELINE_RETENTION_DAYS = 90;
