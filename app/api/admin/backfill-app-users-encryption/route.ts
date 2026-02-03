// app/api/admin/backfill-app-users-encryption/route.ts
import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptMaybe } from "@/lib/fieldCrypto";

type AppUserRow = {
  id: string;

  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  gate_notes: string | null;
  magic_token: string | null;

  phone_encrypted: string | null;
  address_line1_encrypted: string | null;
  address_line2_encrypted: string | null;
  city_encrypted: string | null;
  state_encrypted: string | null;
  zip_encrypted: string | null;
  notes_encrypted: string | null;
  gate_notes_encrypted: string | null;
  magic_token_encrypted: string | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  if (!service) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function buildNeedsBackfillOrFilter() {
  // PostgREST OR syntax must be: and(a,b),and(c,d),and(e,f)
  // "not.is.null" and "is.null" are the valid operators.
  const pairs: Array<[string, string]> = [
    ["phone", "phone_encrypted"],
    ["address_line1", "address_line1_encrypted"],
    ["address_line2", "address_line2_encrypted"],
    ["city", "city_encrypted"],
    ["state", "state_encrypted"],
    ["zip", "zip_encrypted"],
    ["notes", "notes_encrypted"],
    ["gate_notes", "gate_notes_encrypted"],
    ["magic_token", "magic_token_encrypted"],
  ];

  return pairs
    .map(([plain, enc]) => `and(${plain}.not.is.null,${enc}.is.null)`)
    .join(",");
}

export async function POST(req: NextRequest) {
  try {
    const provided = req.headers.get("x-backfill-secret") || "";
    const expected = process.env.BACKFILL_SECRET || "";
    if (!expected) return jsonError("Server missing BACKFILL_SECRET.", 500);
    if (!provided || provided !== expected) return jsonError("Unauthorized.", 401);

    const supabase = getAdminSupabase();

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const dryRunParam = url.searchParams.get("dry_run");

    const limit = Math.max(1, Math.min(500, Number(limitParam || 100)));
    const dryRun = dryRunParam === "1" || dryRunParam === "true";

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
      "magic_token",
      "phone_encrypted",
      "address_line1_encrypted",
      "address_line2_encrypted",
      "city_encrypted",
      "state_encrypted",
      "zip_encrypted",
      "notes_encrypted",
      "gate_notes_encrypted",
      "magic_token_encrypted",
    ].join(",");

    // ✅ FIXED: correct PostgREST OR groups
    const orFilter = buildNeedsBackfillOrFilter();

    const { data: rows, error: selErr } = await supabase
      .from("app_users")
      .select(selectCols)
      .or(orFilter)
      .limit(limit);

    if (selErr) return jsonError(selErr.message, 400);

    const items = (rows as unknown as AppUserRow[]) || [];

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        requested_limit: limit,
        found: items.length,
        sample_ids: items.slice(0, 25).map((r) => r.id),
      });
    }

    let updated = 0;
    let skipped = 0;

    for (const r of items) {
      const patch: Record<string, any> = {};

      // Only fill encrypted fields if plaintext exists AND encrypted is empty
      if (r.phone && !r.phone_encrypted) patch.phone_encrypted = encryptMaybe(r.phone);
      if (r.address_line1 && !r.address_line1_encrypted)
        patch.address_line1_encrypted = encryptMaybe(r.address_line1);
      if (r.address_line2 && !r.address_line2_encrypted)
        patch.address_line2_encrypted = encryptMaybe(r.address_line2);
      if (r.city && !r.city_encrypted) patch.city_encrypted = encryptMaybe(r.city);
      if (r.state && !r.state_encrypted) patch.state_encrypted = encryptMaybe(r.state);
      if (r.zip && !r.zip_encrypted) patch.zip_encrypted = encryptMaybe(r.zip);
      if (r.notes && !r.notes_encrypted) patch.notes_encrypted = encryptMaybe(r.notes);
      if (r.gate_notes && !r.gate_notes_encrypted)
        patch.gate_notes_encrypted = encryptMaybe(r.gate_notes);
      if (r.magic_token && !r.magic_token_encrypted)
        patch.magic_token_encrypted = encryptMaybe(r.magic_token);

      // If nothing to do, skip
      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      // Optional: once encrypted, burn plaintext
      // (Keep this ON to “burn up” PII in cleartext)
      patch.phone = null;
      patch.address_line1 = null;
      patch.address_line2 = null;
      patch.city = null;
      patch.state = null;
      patch.zip = null;
      patch.notes = null;
      patch.gate_notes = null;
      patch.magic_token = null;

      patch.updated_at = new Date().toISOString();

      const { error: updErr } = await supabase.from("app_users").update(patch).eq("id", r.id);
      if (updErr) return jsonError(`Update failed for ${r.id}: ${updErr.message}`, 400);

      updated++;
    }

    return NextResponse.json({
      ok: true,
      requested_limit: limit,
      found: items.length,
      updated,
      skipped,
      note:
        "This uses server AES (FIELD_ENCRYPTION_KEY) and writes to *_encrypted, then nulls plaintext fields.",
    });
  } catch (e: any) {
    return jsonError(e?.message || "Internal error", 500);
  }
}