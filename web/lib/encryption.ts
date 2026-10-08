import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Symmetric encryption for user secrets (LLM API keys, Gmail app passwords,
 * n8n HMAC secrets).
 *
 * Cipher: AES-256-GCM. Format written to Postgres `bytea`:
 *
 *   [ version (1 byte) | iv (12 bytes) | auth-tag (16 bytes) | ciphertext (N) ]
 *
 * Version byte allows future rotation to a new scheme without breaking
 * decrypt paths. Current version = 0x01.
 *
 * Key: `ENCRYPTION_KEY` env, base64-encoded 32 bytes. Lives only in the
 * Vercel server runtime and the Fly.io worker; never shipped to the browser.
 *
 * See docs/security.md for the full encryption boundary spec.
 */

export const ENCRYPTION_VERSION = 0x01;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function loadKey(): Buffer {
  const raw = serverEnv().ENCRYPTION_KEY;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes; got ${key.length}`
    );
  }
  return key;
}

export function encryptForStorage(plaintext: string): Buffer {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptForStorage: plaintext must be a non-empty string");
  }
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([
    Buffer.from([ENCRYPTION_VERSION]),
    iv,
    tag,
    ciphertext,
  ]);
}

export function decryptFromStorage(blob: Uint8Array | Buffer): string {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < 1 + IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("decryptFromStorage: blob too short");
  }
  const version = buf[0];
  if (version !== ENCRYPTION_VERSION) {
    throw new Error(`decryptFromStorage: unknown version ${version}`);
  }
  const iv = buf.subarray(1, 1 + IV_LENGTH);
  const tag = buf.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const key = loadKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Convert an encrypted Buffer to a hex string suitable for a Postgres
 * `\x...` bytea literal when sending via Supabase JS.
 */
export function bufferToPgHex(buf: Buffer): string {
  return `\\x${buf.toString("hex")}`;
}
