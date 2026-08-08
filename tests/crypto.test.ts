import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "test-encryption-secret-do-not-use-in-prod";
});

describe("lib/crypto — secret encryption at rest", () => {
  it("round-trips a secret through encrypt/decrypt", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const plaintext = "sk-ant-super-secret-key-12345";
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", async () => {
    const { encryptSecret } = await import("@/lib/crypto");
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with a tampered ciphertext (AEAD integrity)", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const encrypted = encryptSecret("integrity-check");
    const [iv, tag, data] = encrypted.split(".");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("generateApiKey/hashApiKey produce a verifiable, non-reversible key", async () => {
    const { generateApiKey, hashApiKey } = await import("@/lib/crypto");
    const { full, prefix } = generateApiKey();
    expect(full.startsWith("oas_sk_")).toBe(true);
    expect(full.startsWith(prefix)).toBe(true);
    const hash1 = hashApiKey(full);
    const hash2 = hashApiKey(full);
    expect(hash1).toBe(hash2); // deterministic, so DB lookups by hash work
    expect(hash1).not.toContain(full);
    expect(hashApiKey("a-different-key")).not.toBe(hash1);
  });
});
