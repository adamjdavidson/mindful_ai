import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "../encryption";

// Set a test encryption key (32 bytes hex = 64 chars)
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("encrypt/decrypt roundtrip", () => {
  it("roundtrips a normal string", () => {
    const plaintext = "sk-ant-api03-test-key-1234567890";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("roundtrips an empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // But both decrypt to the same value
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("encrypted format is iv:ciphertext:authTag", () => {
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV is 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag is 16 bytes = 32 hex chars
    expect(parts[2]).toHaveLength(32);
  });
});

describe("decrypt error handling", () => {
  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    // Tamper with the ciphertext
    parts[1] = "ff" + parts[1].slice(2);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("throws on malformed format (missing segments)", () => {
    expect(() => decrypt("just-one-part")).toThrow(
      "Invalid encrypted format",
    );
    expect(() => decrypt("two:parts")).toThrow("Invalid encrypted format");
  });
});
