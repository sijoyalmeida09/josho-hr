import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * Encryption round-trip test. Sets a transient ENCRYPTION_KEY before importing
 * the lib so serverEnv() validation passes in a no-env test environment.
 */
describe("encryption AES-256-GCM", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-of-sufficient-length";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-of-sufficient-length";
    process.env.COMPANION_TOKEN_SECRET = randomBytes(32).toString("base64");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  it("round-trips UTF-8 strings", async () => {
    const { encryptForStorage, decryptFromStorage } = await import("@/lib/encryption");
    const plain = "sk-proj-abc123-🔐-ünicode";
    const blob = encryptForStorage(plain);
    expect(decryptFromStorage(blob)).toBe(plain);
  });

  it("rejects empty plaintext", async () => {
    const { encryptForStorage } = await import("@/lib/encryption");
    expect(() => encryptForStorage("")).toThrow();
  });

  it("produces a new IV each call (non-deterministic output)", async () => {
    const { encryptForStorage } = await import("@/lib/encryption");
    const a = encryptForStorage("same input");
    const b = encryptForStorage("same input");
    expect(a.equals(b)).toBe(false);
  });

  it("rejects tampered ciphertext", async () => {
    const { encryptForStorage, decryptFromStorage } = await import("@/lib/encryption");
    const blob = encryptForStorage("secret");
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptFromStorage(tampered)).toThrow();
  });
});
