// app/api/tech/invoices/route.ts
import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type AnyObj = Record<string, any>;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient<any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isTechRole(role: any) {
  const r = String(role || "").toLowerCase();
  return r === "tech" || r === "technician";
}

function getOrigin(req: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");

  const proto = req.headers.get("x-forwarded-proto");
  const host = req.headers.get("host");
  if (proto && host) return `${proto}://${host}`;

  return "https://glassguardianchipandcrackrepair.com";
}

async function assertActiveTech(req: Request, admin: any) {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const user = data.user;
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  const role =
    (user.app_metadata as AnyObj)?.role ??
    (user.user_metadata as AnyObj)?.role ??
    null;

  if (!isTechRole(role)) return null;

  // 🔒 Real lock: must exist + be active in technicians table
  const { data: techRow, error: techErr } = await admin
    .from("technicians")
    .select("is_active")
    .eq("email", email)
    .maybeSingle();

  if (techErr) return null;
  if (!techRow?.is_active) return null;

  return { user, email };
}

function generateInvoiceNumber() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `GG-${n}`;
}

function generateUserInvite() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `GGU-${n}`;
}

export async function POST(req: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: "Email service not configured (RESEND_API_KEY missing)." },
        { status: 500 }
      );
    }

    const admin = getAdminClient();
    const tech = await assertActiveTech(req, admin);
    if (!tech) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as AnyObj));
    const customer_email = String(body.customer_email || "").trim().toLowerCase();
    const customer_name = body.customer_name ? String(body.customer_name).trim() : null;
    const appointment_id = body.appointment_id ?? null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const tax_percent = Number(body.tax_percent ?? 0);
    const tip_amount = Number(body.tip_amount ?? 0);
    const line_items = Array.isArray(body.line_items) ? body.line_items : [];
    const expires_in_days = Number(body.expires_in_days ?? 14);

    if (!customer_email) {
      return NextResponse.json(
        { error: "customer_email is required" },
        { status: 400 }
      );
    }

    // compute totals
    const subtotal = line_items.reduce((s: number, li: AnyObj) => {
      const qty = Number(li.qty ?? 0);
      const unit = Number(li.unit_price ?? 0);
      return s + Math.max(0, qty) * Math.max(0, unit);
    }, 0);

    const tax_amount = Math.max(0, subtotal * (Math.max(0, tax_percent) / 100));
    const total_amount = subtotal + tax_amount + Math.max(0, tip_amount);

    // 1) insert invoice
    const invoice_number = generateInvoiceNumber();

    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .insert({
        invoice_number,
        invoice_date: new Date().toISOString(),
        customer_email,
        customer_name,
        appointment_id,
        technician_email: tech.email,
        line_items,
        subtotal,
        tax_amount,
        tip_amount,
        total_amount,
        payment_status: "pending",
        notes,
      })
      .select("*")
      .single();

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    // 2) create customer invite (GGU-*)
    const code = generateUserInvite();
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + Math.max(1, expires_in_days));

    const { data: invite, error: cErr } = await admin
      .from("customer_invites")
      .insert({
        code,
        email: customer_email,
        full_name: customer_name,
        phone: null,
        invoice_id: invoice.id,
        expires_at: expires_at.toISOString(),
      })
      .select("*")
      .single();

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    // also back-reference on invoice for convenience (best-effort)
    await admin.from("invoices").update({ customer_invite_code: code }).eq("id", invoice.id);

    // 3) mandatory email send
    const resend = new Resend(resendKey);
    const origin = getOrigin(req);

    const redirect = `/user/onboard?invoice=${encodeURIComponent(String(invoice.id))}`;
    const signupLink =
      `${origin}/signup?role=user` +
      `&email=${encodeURIComponent(customer_email)}` +
      `&code=${encodeURIComponent(code)}` +
      `&redirect=${encodeURIComponent(redirect)}`;

    const subject = `Your Glass Guardian invoice ${invoice_number}`;

    const html = `
      <div style="font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto; line-height:1.6; color:#0f172a">
        <h2 style="margin:0 0 8px">Your Glass Guardian Invoice</h2>
        <p>Hi ${customer_name || "there"},</p>
        <p>We’ve created your invoice <strong>${invoice_number}</strong>.</p>
        <p>Total due: <strong>$${Number(invoice.total_amount).toFixed(2)}</strong></p>
        <p style="margin:16px 0">
          <a href="${signupLink}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;display:inline-block">
            Create your account & view invoice
          </a>
        </p>
        <p>Your signup requires your code: <strong>${code}</strong></p>
        <p>You’ll then see your warranty, payments, and service history in your dashboard.</p>
        <p style="color:#475569">— Glass Guardian</p>
      </div>
    `;

    // NOTE: Use a verified domain in Resend (recommended)
    const from =
      process.env.RESEND_FROM_EMAIL ||
      "Glass Guardian <noreply@glassguardianchipandcrackrepair.com>";

    try {
      await resend.emails.send({
        from,
        to: customer_email,
        subject,
        html,
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: `Failed to send invite email: ${e?.message || String(e)}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, invoice, invite });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}