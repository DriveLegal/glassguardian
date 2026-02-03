// lib/fieldCrypto.ts
import "server-only";
import crypto from "crypto";

/**
 * Server-only AES-256-GCM field encryption (production-safe)
 *
 * Payload formats:
 *   v1:<ivHex>:<cipherHex>:<tagHex>
 *   (legacy) <ivHex>:<cipherHex>:<tagHex>
 *
 * Optional key rotation:
 *   - FIELD_ENCRYPTION_KEY (current, required)
 *   - FIELD_ENCRYPTION_KEY_OLD (optional, previous key)
 */

if (typeof window !== "undefined") {
  throw new Error("fieldCrypto.ts must only be used on the server (Node runtime).");
}

const VERSION = "v1";
const SEP = ":";

function requireHexKey(name: string, value: string | undefined) {
  if (!value) return null;
  const v = value.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error(`${name} must be exactly 64 hex characters (32 bytes).`);
  }
  const buf = Buffer.from(v, "hex");
  if (buf.length !== 32) {
    throw new Error(`${name} must decode to 32 bytes (AES-256).`);
  }
  return buf;
}

const KEY_CURRENT = requireHexKey("FIELD_ENCRYPTION_KEY", process.env.FIELD_ENCRYPTION_KEY);
if (!KEY_CURRENT) {
  throw new Error("Missing env: FIELD_ENCRYPTION_KEY (must be 64 hex chars).");
}

const KEY_OLD = requireHexKey("FIELD_ENCRYPTION_KEY_OLD", process.env.FIELD_ENCRYPTION_KEY_OLD);

function pack(iv: Buffer, ciphertext: Buffer, tag: Buffer) {
  return `${VERSION}${SEP}${iv.toString("hex")}${SEP}${ciphertext.toString("hex")}${SEP}${tag.toString("hex")}`;
}

function unpack(payload: string) {
  const p = (payload ?? "").toString().trim();
  if (!p) return null;

  const parts = p.split(SEP).filter(Boolean);

  const hasVersion = parts[0] === VERSION;
  const offset = hasVersion ? 1 : 0;

  const ivHex = parts[offset];
  const cipherHex = parts[offset + 1];
  const tagHex = parts[offset + 2];

  if (!ivHex || !cipherHex || !tagHex) return null;

  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  if (iv.length !== 12) return null; // GCM IV
  if (tag.length !== 16) return null; // GCM tag
  if (ciphertext.length === 0) return null;

  return { iv, ciphertext, tag };
}

export function encryptField(plainText: string) {
  const text = (plainText ?? "").toString();
  if (!text) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY_CURRENT!, iv);

  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return pack(iv, ciphertext, tag);
}

function decryptWithKey(payload: string, key: Buffer) {
  const parsed = unpack(payload);
  if (!parsed) throw new Error("Invalid encrypted payload format.");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, parsed.iv);
  decipher.setAuthTag(parsed.tag);

  const plain = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export function decryptField(payload: string) {
  // Try current key first
  try {
    return decryptWithKey(payload, KEY_CURRENT!);
  } catch {
    // Optional: try old key for rotated data
    if (KEY_OLD) return decryptWithKey(payload, KEY_OLD);
    throw new Error("Failed to decrypt payload with current key.");
  }
}

// Convenience helpers
export function encryptMaybe(value: string | null | undefined) {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? encryptField(v) : null;
}

export function decryptMaybe(value: string | null | undefined) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return null;
  try {
    return decryptField(v);
  } catch {
    return null; // never crash callers
  }
}