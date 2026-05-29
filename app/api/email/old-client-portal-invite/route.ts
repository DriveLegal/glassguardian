//app/api/email/old-client-portal-invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

type Body = {
  email: string;
  fullName?: string;
  warrantyNumber: string;
  warrantyExpiration: string;

  // ✅ New field (preferred)
  dateServicedPerformed?: string; // e.g. "Jan 11, 2026" or "2026-01-11"

  // ✅ UPDATE: accept common date keys your admin UI may send
  serviceDate?: string; // e.g. "2026-01-11"
  service_date?: string; // e.g. "2026-01-11"

  // ✅ Backwards-compat
  servicePerformed?: string;
};

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://glassguardianchipandcrackrepair.com"
  );
}

function getFirstName(fullName?: string) {
  const n = (fullName || "").trim();
  if (!n) return "";
  const first = n.split(/\s+/)[0]?.replace(/[,\s]+/g, "") || "";
  return first;
}

function looksLikeDate(s?: string) {
  const v = String(s || "").trim();
  if (!v) return false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return true; // ISO
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) return true; // Slash
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(v))
    return true; // Month name

  return false;
}

function safeText(s: any) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

// ✅ normalize to a friendly display date (keeps raw if unknown format)
function formatDisplayDate(input: string) {
  const v = safeText(input);
  if (!v) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(d);
    }
  }

  const d2 = new Date(v);
  if (!Number.isNaN(d2.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(d2);
  }

  return v;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return null;

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

async function sendOldClientPortalInviteEmail({
  email,
  fullName,
  warrantyNumber,
  warrantyExpiration,
  dateServicedPerformed,
}: {
  email: string;
  fullName?: string;
  warrantyNumber: string;
  warrantyExpiration: string;
  dateServicedPerformed: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Luis Hernandez (Glass Guardian) <noreply@glassguardianchipandcrackrepair.com>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY missing; skipping old-client portal email.");
    return;
  }

  const resend = new Resend(apiKey);
  const baseUrl = getBaseUrl();

  const createPasswordUrl = `${baseUrl}/user/old-client/create-password?email=${encodeURIComponent(
    email
  )}`;

  const firstName = getFirstName(fullName);
  const safeName = firstName || "there";

  const subject = "Windshield Repair - Glass Guardian New Updated Portal";

  const prettyDate = dateServicedPerformed
    ? formatDisplayDate(dateServicedPerformed)
    : "On file";

  const text = `Hi ${safeName},

I’m Luis Hernandez, the owner of Glass Guardian Chip & Crack Repair. Thank you again for trusting us with your vehicle.

Since your last visit, we’ve upgraded your customer experience with a secure portal — a private place to keep everything related to your service in one spot.

Thank-you perk: once you create your portal account, you automatically get 10% off your next service.

Service details:
- Date serviced: ${prettyDate}
- Warranty #: ${warrantyNumber}
- Coverage through: ${warrantyExpiration}

Set your portal password (takes about 20 seconds — your details are already loaded):
${createPasswordUrl}

If you ever need anything — questions, concerns, or a quick recommendation — call/text us at (909) 529-1798.

Appreciate you again,
Luis Hernandez
Owner, Glass Guardian Chip & Crack Repair

If you didn’t expect this email, you can safely ignore it.`;

  // ✅ Color + brightness tuned down, text contrast + "wow" emphasis increased (email-safe)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Glass Guardian Portal Access</title>
  <style>
    /* === GLOBAL LAYOUT (DARKER / LESS BRIGHT) === */
    body {
      margin:0;
      padding:0;
      background:#01030c;
    }
    table { border-collapse:collapse; }
    .wrap { width:100%; background:#01030c; }
    .container {
      width:100%;
      max-width:640px;
      margin:0 auto;
      padding:26px 16px 44px;
    }

    /* === 3D BRAND PILL / HEADER (SUBDUED) === */
    .pill {
      display:inline-block;
      padding:10px 18px;
      border-radius:999px;
      background:
        radial-gradient(circle at 20% 0%, rgba(148,163,184,0.18), transparent 60%),
        linear-gradient(135deg, rgba(9,14,28,0.92), rgba(6,10,22,0.98));
      border:1px solid rgba(148,163,184,0.28);
      box-shadow:
        0 12px 28px rgba(0,0,0,0.78),
        0 0 0 1px rgba(5,8,18,0.90),
        inset 0 0 0 1px rgba(255,255,255,0.05);
      white-space:nowrap;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      position:relative;
      overflow:hidden;
    }
    .pill::after {
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      background:
        linear-gradient(120deg, rgba(148,163,184,0.16), transparent 40%, transparent 60%, rgba(148,163,184,0.08));
      mix-blend-mode:screen;
      opacity:0.28;
    }
    .pillText {
      font-size:12px;
      font-weight:900;
      letter-spacing:.085em;
      text-transform:uppercase;
      color:#f8fafc;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.35),
        0 0 14px rgba(125,211,252,0.10);
    }
    .accent {
      display:inline-block;
      width:14px;
      height:2px;
      border-radius:999px;
      background:linear-gradient(90deg,#16a34a,#0284c7,#38bdf8);
      margin:0 10px;
      box-shadow:0 0 12px rgba(14,165,233,0.25);
    }

    /* Tag under logo (CRISPER TYPE) */
    .tag {
      display:inline-block;
      padding:7px 12px;
      border-radius:999px;
      font-size:10px;
      font-weight:950;
      letter-spacing:.12em;
      text-transform:uppercase;
      background:
        linear-gradient(135deg, rgba(9,14,28,0.92), rgba(6,10,22,0.98));
      border:1px solid rgba(148,163,184,0.26);
      color:#f8fafc;
      box-shadow:
        0 10px 22px rgba(0,0,0,0.55),
        inset 0 0 0 1px rgba(255,255,255,0.03);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    }
    .dot {
      display:inline-block;
      width:7px;
      height:7px;
      border-radius:999px;
      background:#22c55e;
      box-shadow:0 0 0 3px rgba(34,197,94,0.16);
      margin-right:8px;
      vertical-align:1px;
    }

    /* === OUTER 3D FRAME (DIMMER, DEEPER) === */
    .shell {
      border-radius:24px;
      padding:1px;
      background:
        radial-gradient(1200px 520px at 20% 0%,
          rgba(56,189,248,0.34),
          rgba(34,197,94,0.16),
          rgba(2,6,23,0) 72%),
        linear-gradient(135deg,
          rgba(56,189,248,0.28),
          rgba(34,197,94,0.18),
          rgba(79,70,229,0.16));
      box-shadow:
        0 26px 78px rgba(0,0,0,0.90),
        0 0 0 1px rgba(5,8,18,0.92),
        inset 0 0 0 1px rgba(148,163,184,0.14);
      position:relative;
      overflow:hidden;
    }
    .shell::before {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      background:
        linear-gradient(115deg, rgba(148,163,184,0.12), transparent 30%, transparent 70%, rgba(148,163,184,0.07)),
        radial-gradient(900px 480px at 100% 0%, rgba(56,189,248,0.12), transparent 72%);
      mix-blend-mode:screen;
      opacity:0.48;
    }

    /* === INNER CARD (DARKER GLASS + BETTER TYPE POP) === */
    .card {
      border-radius:23px;
      padding:28px 26px 26px;
      background:
        radial-gradient(circle at 15% 0%, rgba(56,189,248,0.14), transparent 62%),
        radial-gradient(circle at 100% 0%, rgba(34,197,94,0.10), transparent 70%),
        radial-gradient(circle at 50% 120%, rgba(79,70,229,0.18), rgba(7,10,22,0.985)),
        linear-gradient(145deg, rgba(1,3,12,0.985), rgba(2,6,23,0.995));
      box-shadow:
        0 22px 74px rgba(0,0,0,0.88),
        inset 0 0 40px rgba(1,3,12,0.92),
        inset 0 0 0 1px rgba(148,163,184,0.12);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      color:#e5e7eb;
      position:relative;
      overflow:hidden;
    }
    .card::after {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      background:
        linear-gradient(180deg, rgba(2,6,23,0.42), transparent 28%, transparent 72%, rgba(0,0,0,0.72));
      mix-blend-mode:multiply;
      opacity:0.78;
    }

    /* === WELCOME CHIP (LESS NEON, MORE PREMIUM) === */
    .welcomeTop { text-align:center; margin:0 0 12px; position:relative; z-index:2; }
    .welcomeChip {
      display:inline-block;
      padding:7px 14px;
      border-radius:999px;
      background:
        radial-gradient(circle at 20% 0%, rgba(56,189,248,0.22), transparent 62%),
        linear-gradient(135deg, rgba(10,14,30,0.98), rgba(5,8,18,0.995));
      border:1px solid rgba(148,163,184,0.36);
      color:#f8fafc;
      font-size:11px;
      font-weight:950;
      letter-spacing:.24em;
      text-transform:uppercase;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.35),
        0 0 16px rgba(125,211,252,0.16);
      box-shadow:
        0 14px 34px rgba(0,0,0,0.78),
        inset 0 0 0 1px rgba(255,255,255,0.05);
      animation: welcomeGlow 3.2s ease-in-out infinite;
    }
    @keyframes welcomeGlow{
      0% {
        transform:translateY(0) scale(.99);
        opacity:.94;
        box-shadow:
          0 14px 30px rgba(0,0,0,0.74),
          inset 0 0 0 1px rgba(255,255,255,.04);
      }
      50% {
        transform:translateY(-1px) scale(1.02);
        opacity:1;
        box-shadow:
          0 18px 42px rgba(0,0,0,0.84),
          0 0 18px rgba(56,189,248,.20),
          0 0 12px rgba(34,197,94,.10),
          inset 0 0 0 1px rgba(255,255,255,.06);
      }
      100% {
        transform:translateY(0) scale(.99);
        opacity:.94;
        box-shadow:
          0 14px 30px rgba(0,0,0,0.74),
          inset 0 0 0 1px rgba(255,255,255,.04);
      }
    }

    /* === TEXT (MORE WOW + READABILITY) === */
    .p {
      font-size:14px;
      line-height:1.7;
      margin:0 0 14px;
      color:#e8eef6;
      position:relative;
      z-index:2;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.42),
        0 0 18px rgba(56,189,248,0.06);
    }
    .p strong {
      color:#f8fafc;
      font-weight:950;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.46),
        0 0 22px rgba(125,211,252,0.10);
    }

    .nameBadge {
      display:inline-block;
      padding:2px 8px;
      border-radius:999px;
      background:linear-gradient(135deg, rgba(56,189,248,0.16), rgba(34,197,94,0.10), rgba(129,140,248,0.14));
      border:1px solid rgba(56,189,248,0.26);
      color:#f8fafc;
      font-weight:950;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.45),
        0 0 18px rgba(56,189,248,0.12);
      box-shadow:
        0 10px 24px rgba(0,0,0,0.72),
        0 0 12px rgba(56,189,248,0.18);
    }

    .divider {
      height:1px;
      background:linear-gradient(90deg, rgba(56,189,248,0), rgba(56,189,248,0.26), rgba(34,197,94,0.18), rgba(129,140,248,0.18), rgba(56,189,248,0));
      margin:18px 0;
      position:relative;
      z-index:2;
    }

    /* === BAND (DIMMED) === */
    .band {
      border-radius:18px;
      padding:18px 16px 18px;
      margin:6px 0 18px;
      background:
        radial-gradient(900px 380px at 20% 0%, rgba(56,189,248,0.18), rgba(34,197,94,0.10), rgba(129,140,248,0.08), rgba(2,6,23,0) 74%),
        linear-gradient(135deg, rgba(56,189,248,0.10), rgba(34,197,94,0.08), rgba(79,70,229,0.10));
      border:1px solid rgba(56,189,248,0.18);
      box-shadow:
        0 18px 44px rgba(0,0,0,0.84),
        inset 0 0 0 1px rgba(255,255,255,0.02);
      position:relative;
      z-index:1;
    }

    /* === PERK CARD (LESS BRIGHT, STILL SPECIAL) === */
    .perk {
      background:linear-gradient(135deg, rgba(34,197,94,0.16), rgba(56,189,248,0.10), rgba(129,140,248,0.10));
      border:1px solid rgba(34,197,94,0.22);
      border-radius:16px;
      padding:14px;
      margin:14px 0 18px;
      color:#ddfbe9;
      font-size:13px;
      line-height:1.7;
      box-shadow:
        0 18px 40px rgba(0,0,0,0.82),
        0 0 14px rgba(34,197,94,0.18);
      position:relative;
      overflow:hidden;
    }
    .perk::before {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      background:
        radial-gradient(circle at 10% 0%, rgba(187,247,208,0.22), transparent 58%),
        radial-gradient(circle at 100% 100%, rgba(56,189,248,0.14), transparent 65%);
      mix-blend-mode:screen;
      opacity:0.62;
    }
    .perkBadge {
      display:inline-block;
      font-size:10px;
      letter-spacing:.14em;
      text-transform:uppercase;
      padding:6px 10px;
      border-radius:999px;
      background:rgba(34,197,94,0.12);
      border:1px solid rgba(34,197,94,0.24);
      color:#c8f9da;
      margin-bottom:10px;
      font-weight:950;
      position:relative;
      z-index:1;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.45),
        0 0 16px rgba(34,197,94,0.10);
    }

    /* === META "CARD" (HIGH CONTRAST NUMBERS) === */
    .meta {
      background:
        radial-gradient(circle at 0% 0%, rgba(56,189,248,0.12), transparent 60%),
        radial-gradient(circle at 100% 0%, rgba(129,140,248,0.10), transparent 66%),
        linear-gradient(145deg, rgba(9,14,30,0.96), rgba(6,12,26,0.99));
      border:1px solid rgba(148,163,184,0.24);
      border-radius:16px;
      padding:12px 14px;
      margin:14px 0 16px;
      box-shadow:
        0 18px 44px rgba(0,0,0,0.86),
        inset 0 0 0 1px rgba(4,7,16,0.88);
      position:relative;
      overflow:hidden;
    }
    .meta::before {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      background:
        linear-gradient(135deg, rgba(148,163,184,0.10), transparent 42%),
        radial-gradient(circle at 100% 0%, rgba(56,189,248,0.10), transparent 60%);
      mix-blend-mode:screen;
      opacity:0.45;
    }
    .metaRow { padding:10px 0; border-bottom:1px solid rgba(148,163,184,0.12); }
    .metaRow:last-child { border-bottom:none; }
    .metaL { font-size:13px; color:#a6b0c2; }
    .metaR {
      font-size:13px;
      color:#e9f6ff;
      font-weight:900;
      text-align:right;
      text-shadow:
        0 1px 0 rgba(0,0,0,0.50),
        0 0 18px rgba(56,189,248,0.20);
    }

    /* === CTA BUTTON (LESS BRIGHT, MORE LUXE) === */
    .cta {
      text-align:center;
      margin:18px 0 10px;
      position:relative;
      z-index:2;
    }
    .btn {
      display:inline-block;
      padding:14px 28px;
      border-radius:999px;
      font-size:13px;
      font-weight:950;
      letter-spacing:.09em;
      text-transform:uppercase;
      background:
        radial-gradient(circle at 20% 0%, rgba(255,255,255,0.48), transparent 58%),
        linear-gradient(135deg,#22c55e,#0ea5e9,#38bdf8);
      color:#020617 !important;
      text-decoration:none;
      border:1px solid rgba(255,255,255,0.16);
      box-shadow:
        0 18px 38px rgba(0,0,0,0.78),
        0 0 18px rgba(14,165,233,0.20),
        0 0 14px rgba(34,197,94,0.16),
        inset 0 0 0 1px rgba(15,23,42,0.22);
      white-space:nowrap;
    }
    .micro {
      font-size:12px;
      color:#a5b0c2;
      margin-top:10px;
      line-height:1.55;
      position:relative;
      z-index:2;
      text-shadow:0 1px 0 rgba(0,0,0,0.35);
    }

    /* === SUPPORT + NOTE (DIMMED BUT LEGIBLE) === */
    .support {
      margin:8px 0 0;
      text-align:center;
      font-size:12px;
      color:#a5b0c2;
      line-height:1.55;
      position:relative;
      z-index:2;
      text-shadow:0 1px 0 rgba(0,0,0,0.35);
    }
    .support strong { color:#f8fafc; text-shadow:0 0 16px rgba(125,211,252,0.10); }

    .note {
      background:linear-gradient(135deg, rgba(56,189,248,0.12), rgba(79,70,229,0.10), rgba(56,189,248,0.10));
      border:1px solid rgba(56,189,248,0.18);
      border-radius:16px;
      padding:14px;
      margin:14px 0 18px;
      color:#e8f6ff;
      font-size:13px;
      line-height:1.7;
      box-shadow:
        0 18px 40px rgba(0,0,0,0.84),
        0 0 14px rgba(56,189,248,0.16);
      position:relative;
      overflow:hidden;
    }
    .note::before {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      background:
        radial-gradient(circle at 10% 0%, rgba(129,140,248,0.16), transparent 60%),
        radial-gradient(circle at 100% 100%, rgba(56,189,248,0.12), transparent 70%);
      mix-blend-mode:screen;
      opacity:0.58;
    }

    .code {
      background:rgba(1,3,12,0.92);
      border:1px solid rgba(56,189,248,0.22);
      border-radius:12px;
      padding:12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "SF Mono", monospace;
      font-size:11px;
      color:#e9f6ff;
      word-break:break-all;
      margin:10px 0 18px;
      box-shadow:
        0 14px 34px rgba(0,0,0,0.86),
        inset 0 0 0 1px rgba(4,7,16,0.88);
      position:relative;
      overflow:hidden;
    }
    .code::before {
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      pointer-events:none;
      background:linear-gradient(135deg, rgba(56,189,248,0.12), transparent 50%);
      mix-blend-mode:screen;
      opacity:0.55;
    }

    .footer {
      text-align:center;
      margin-top:18px;
      font-size:11px;
      color:#7a869b;
      line-height:1.65;
      position:relative;
      z-index:2;
      text-shadow:0 1px 0 rgba(0,0,0,0.35);
    }

    a { color:#7dd3fc; }

    /* === MOBILE FALLBACKS === */
    @media (max-width:480px) {
      .container { padding:18px 10px 32px; }
      .card { padding:22px 18px 20px; }
      .metaL, .metaR { font-size:12px; }
      .btn { width:100%; text-align:center; padding:13px 14px; }
    }
  </style>
</head>
<body>
  <table class="wrap" role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">

        <div class="container">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:0 0 10px 0;">
                <span class="pill">
                  <span class="pillText">Glass Guardian</span>
                  <span class="accent"></span>
                  <span class="pillText">Chip &amp; Crack Repair</span>
                </span>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 0 14px 0;">
                <span class="tag"><span class="dot"></span>New Customer Portal</span>
              </td>
            </tr>
          </table>

          <div class="shell">
            <div class="card">

              <div class="band">
                <div class="welcomeTop">
                  <span class="welcomeChip">WELCOME</span>
                </div>

                <p class="p">Hello <span class="nameBadge">${safeName}</span>,</p>

                <p class="p">
                  I’m <strong>Luis Hernandez</strong>, the owner of <strong>Glass Guardian Chip &amp; Crack Repair</strong>.
                  Thank you again for trusting us with your windshield repair on your vehicle — we truly appreciate you.
                </p>

                <p class="p">
                  <strong>Since your last visit,</strong> we’ve upgraded your customer experience with a <strong>secure portal —</strong>
                  a simple, private place to keep everything related to your service in one spot.
                </p>

                <div class="perk">
                  <div class="perkBadge">Thank-you perk</div>
                  <div style="position:relative; z-index:1;">
                    Once you create your portal account, you automatically get <strong>10% off your next service</strong>.
                    <div style="margin-top:8px; color:#bff7dc; font-size:12px; line-height:1.55; text-shadow:0 1px 0 rgba(0,0,0,0.35);">
                      No coupon needed — it’s tied to your account after setup.
                    </div>
                  </div>
                </div>

                <div class="divider"></div>

                <div class="meta">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr class="metaRow">
                      <td class="metaL">Service date</td>
                      <td class="metaR">${prettyDate}</td>
                    </tr>
                    <tr class="metaRow">
                      <td class="metaL">Warranty number</td>
                      <td class="metaR">${warrantyNumber}</td>
                    </tr>
                    <tr class="metaRow">
                      <td class="metaL" style="padding-top:10px;">Coverage through</td>
                      <td class="metaR" style="padding-top:10px;">${warrantyExpiration}</td>
                    </tr>
                  </table>
                </div>

                <div class="cta">
                  <a class="btn" href="${createPasswordUrl}">Set My Portal Password</a>
                  <div class="micro">Takes about 20 seconds — your details are already loaded.</div>
                </div>

                <div class="support">
                  Need help? Reply to this email or text <strong>(909) 529-1798</strong>
                </div>

                <div class="note">
                  <div style="position:relative; z-index:1;">
                    <strong>Quick note:</strong> If you ever notice a chip starting to spread (temperature swings can do that),
                    the portal makes it easy to request a follow-up — fast and straightforward.
                  </div>
                </div>

                <p class="micro">
                  For your protection, this secure link is intended only for you. If anything looks off, don’t click — just reach out and we’ll help.
                </p>

                <p class="p" style="margin-top:12px; font-size:13px; color:#cbd5e1;">
                  If the button doesn’t work, copy this link into your browser:
                </p>

                <div class="code">${createPasswordUrl}</div>

                <p class="p">
                 Please feel free to visit the home page for more information: <strong>glassguardianchipandcrackrepair.com</strong>.
                </p>
              </div>

              <p class="p" style="margin:0 0 6px; font-size:12px; color:#7a869b;">
                If you didn’t expect this email, you can safely ignore it.
              </p>

              <div class="footer">
                &copy; ${new Date().getFullYear()} Glass Guardian Chip &amp; Crack Repair<br/>
                Precision, protection, and peace of mind.
              </div>

            </div>
          </div>
        </div>

      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from,
    to: email,
    subject,
    text,
    html,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Body>;

    const email = safeText(body.email).toLowerCase();
    const fullName = safeText(body.fullName);
    const warrantyNumber = safeText(body.warrantyNumber);
    const warrantyExpiration = safeText(body.warrantyExpiration);

    const rawDate = safeText(body.dateServicedPerformed);
    const rawServiceDateAlt = safeText(body.serviceDate || body.service_date);
    const rawService = safeText(body.servicePerformed);

    let dateServicedPerformed = rawDate;

    if (!dateServicedPerformed && rawServiceDateAlt) {
      dateServicedPerformed = rawServiceDateAlt;
    }

    if (!dateServicedPerformed && looksLikeDate(rawService)) {
      dateServicedPerformed = rawService;
    }

    if (!email || !warrantyNumber || !warrantyExpiration) {
      return NextResponse.json(
        { error: "email, warrantyNumber, and warrantyExpiration are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { error: upErr } = await supabaseAdmin
        .from("app_users")
        .update({ portal_invited_at: new Date().toISOString() })
        .eq("email", email);

      if (upErr) console.warn("portal_invited_at update failed:", upErr.message);

      if (!dateServicedPerformed) {
        const { data: w, error: wErr } = await supabaseAdmin
          .from("warranties")
          .select("service_date")
          .eq("warranty_number", warrantyNumber)
          .eq("customer_email", email)
          .maybeSingle();

        if (wErr) {
          console.warn(
            "warranties lookup for service_date failed:",
            wErr.message
          );
        } else if (w?.service_date) {
          dateServicedPerformed = String(w.service_date);
        }
      }
    } else {
      console.warn(
        "Supabase admin not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing). Invite flag not set."
      );
    }

    if (!dateServicedPerformed) {
      dateServicedPerformed = "On file";
    }

    await sendOldClientPortalInviteEmail({
      email,
      fullName,
      warrantyNumber,
      warrantyExpiration,
      dateServicedPerformed,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("Error in /api/email/old-client-portal-invite:", err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}