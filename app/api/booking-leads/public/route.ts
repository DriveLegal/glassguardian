// app/api/booking-leads/public/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? "").trim());
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const fullName = String(body?.fullName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const date = String(body?.date ?? "").trim(); // yyyy-mm-dd
    const time = String(body?.time ?? "").trim(); // HH:mm
    const source = String(body?.source ?? "app_home_quick_book").trim();

    // Required-by-table (but UI doesn't collect them)
    const phone = String(body?.phone ?? "0000000000").trim();
    const zip = String(body?.zip ?? "00000").trim();
    const chipsRaw = body?.chips ?? 0;
    const chips = Number.isFinite(Number(chipsRaw)) ? Number(chipsRaw) : 0;

    if (fullName.length < 2) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "Date is required." }, { status: 400 });
    }
    if (!time) {
      return NextResponse.json({ error: "Time is required." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Phone is required by table." }, { status: 400 });
    }
    if (!zip) {
      return NextResponse.json({ error: "Zip is required by table." }, { status: 400 });
    }

    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // booking_leads columns you showed:
    // full_name (required), phone (required), zip (required), chips (required), slot (nullable), source (nullable)
    const { error } = await sb.from("booking_leads").insert({
      full_name: fullName,
      phone,
      zip,
      chips,
      slot: `${date} ${time}`,
      source,
    });

    if (error) {
      return NextResponse.json(
        { error: `Supabase insert failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || "Server error") },
      { status: 500 }
    );
  }
}