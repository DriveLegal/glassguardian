// scripts/backfillAppUsersEncrypted.mjs
/**
 * Backfill app_users *_encrypted columns from legacy plaintext columns.
 *
 * ✅ Works with Next-style env files:
 *    - loads .env.local first (if present)
 *    - then falls back to .env
 *
 * Run:
 *   npm i dotenv
 *   node scripts/backfillAppUsersEncrypted.mjs
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/* -------------------------------------------------------
   Load env (.env.local preferred)
------------------------------------------------------- */

const root = process.cwd();
const envLocal = path.join(root, ".env.local");
const envDefault = path.join(root, ".env");

if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config({ path: envDefault });
}

/* -------------------------------------------------------
   Env validation
------------------------------------------------------- */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyHex = process.env.FIELD_ENCRYPTION_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local or .env)."
  );
}

if (!keyHex) {
  throw new Error("Missing FIELD_ENCRYPTION_KEY (must be 64 hex chars).");
}

if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
  throw new Error("FIELD_ENCRYPTION_KEY must be exactly 64 hex characters.");
}

const key = Buffer.from(keyHex, "hex");
if (key.length !== 32) {
  throw new Error("FIELD_ENCRYPTION_KEY must decode to 32 bytes (AES-256).");
}

/* -------------------------------------------------------
   Crypto helpers (AES-256-GCM)
------------------------------------------------------- */

const VERSION = "v1";
const SEP = ":";

function encryptField(plainText) {
  const text = String(plainText ?? "");
  if (!text) return null;

  const iv = crypto.randomBytes(12); // GCM standard
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${VERSION}${SEP}${iv.toString("hex")}${SEP}${ciphertext.toString(
    "hex"
  )}${SEP}${tag.toString("hex")}`;
}

function encryptMaybe(v) {
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  return s ? encryptField(s) : null;
}

/* -------------------------------------------------------
   Supabase admin client
------------------------------------------------------- */

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* -------------------------------------------------------
   Backfill
------------------------------------------------------- */

function summarizeCount(arr) {
  return Array.isArray(arr) ? arr.length : 0;
}

async function main() {
  const pageSize = 500;
  let from = 0;

  const selectCols = [
    "id",
    "phone",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "zip",
    "notes",
    "gate_notes",
    "phone_encrypted",
    "address_line1_encrypted",
    "address_line2_encrypted",
    "city_encrypted",
    "state_encrypted",
    "zip_encrypted",
    "notes_encrypted",
    "gate_notes_encrypted",
  ].join(",");

  console.log("🔐 Backfill starting…");
  console.log("• Page size:", pageSize);
  console.log("• Using env file:", fs.existsSync(envLocal) ? ".env.local" : ".env");

  while (true) {
    const { data, error } = await admin
      .from("app_users")
      .select(selectCols)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Fetch failed: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    let updatedThisPage = 0;

    for (const row of data) {
      const patch = { updated_at: new Date().toISOString() };

      // Only fill encrypted if missing (and plaintext exists)
      if (!row.phone_encrypted && row.phone) patch.phone_encrypted = encryptMaybe(row.phone);
      if (!row.address_line1_encrypted && row.address_line1)
        patch.address_line1_encrypted = encryptMaybe(row.address_line1);
      if (!row.address_line2_encrypted && row.address_line2)
        patch.address_line2_encrypted = encryptMaybe(row.address_line2);
      if (!row.city_encrypted && row.city) patch.city_encrypted = encryptMaybe(row.city);
      if (!row.state_encrypted && row.state) patch.state_encrypted = encryptMaybe(row.state);
      if (!row.zip_encrypted && row.zip) patch.zip_encrypted = encryptMaybe(row.zip);
      if (!row.notes_encrypted && row.notes) patch.notes_encrypted = encryptMaybe(row.notes);
      if (!row.gate_notes_encrypted && row.gate_notes)
        patch.gate_notes_encrypted = encryptMaybe(row.gate_notes);

      const keys = Object.keys(patch).filter((k) => k !== "updated_at");
      if (keys.length === 0) continue;

      const { error: upErr } = await admin.from("app_users").update(patch).eq("id", row.id);

      if (upErr) {
        console.error("❌ Update failed:", row.id, upErr.message);
        continue;
      }

      updatedThisPage += 1;
    }

    from += pageSize;

    console.log(
      `…processed ${from} rows (page size ${pageSize}) | updated this page: ${updatedThisPage} | fetched: ${summarizeCount(
        data
      )}`
    );
  }

  console.log("✅ Backfill complete.");
}

main().catch((e) => {
  console.error("💥 Backfill crashed:", e?.message || e);
  process.exit(1);
});