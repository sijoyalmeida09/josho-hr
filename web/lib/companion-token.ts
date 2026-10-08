import { SignJWT, jwtVerify } from "jose";
import { createHash, randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Companion token: short-lived (≤ 90 days) JWT the user downloads with the
 * local-sync CLI. See docs/companion.md for the full contract.
 *
 *   aud = "companion"
 *   sub = <user_id>
 *   jti = <uuid>
 *   iat, exp
 *
 * The SHA-256 hash of the raw token (hex) is stored in
 * public.companion_tokens.token_hash. Revocation sets revoked_at on that row.
 */

const AUDIENCE = "companion";
const ISSUER = "josho-hr";
const MAX_TTL_SECONDS = 60 * 60 * 24 * 90;

function secretKey(): Uint8Array {
  const raw = serverEnv().COMPANION_TOKEN_SECRET;
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length < 32) {
    throw new Error("COMPANION_TOKEN_SECRET must be ≥ 32 bytes base64-encoded");
  }
  return bytes;
}

export async function issueCompanionToken(
  userId: string,
  ttlSeconds: number = MAX_TTL_SECONDS
): Promise<{ token: string; jti: string; hash: string; expiresAt: Date }> {
  const effectiveTtl = Math.min(ttlSeconds, MAX_TTL_SECONDS);
  const jti = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + effectiveTtl;

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(AUDIENCE)
    .setIssuer(ISSUER)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secretKey());

  const hash = createHash("sha256").update(token).digest("hex");
  return { token, jti, hash, expiresAt: new Date(exp * 1000) };
}

export async function verifyCompanionToken(
  token: string
): Promise<{ userId: string; jti: string; hash: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      audience: AUDIENCE,
      issuer: ISSUER,
    });
    if (!payload.sub || !payload.jti) return null;
    const hash = createHash("sha256").update(token).digest("hex");
    return { userId: payload.sub, jti: payload.jti, hash };
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
