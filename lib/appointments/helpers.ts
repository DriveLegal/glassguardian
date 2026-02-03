// lib/appointments/helpers.ts
import { format } from "date-fns";

export type AnyObj = Record<string, any>;

export const CANCELLABLE_STATUSES = [
  "requested",
  "estimating",
  "estimate_sent",
  "approved",
  "scheduled",
] as const;

export function canCancelStatus(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  return (CANCELLABLE_STATUSES as readonly string[]).includes(normalized);
}

/* ---------------- Waiver types + helpers ---------------- */

export type WaiverRow = {
  id: string;
  appointment_id: string;
  signer_name: string;
  initials: string;
  signature_storage_path?: string | null;
  created_at?: string | null;
};

export function normalizeInitials(v: string) {
  return String(v ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

export function normalizeName(v: string) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function buildWaiverText(appt: any) {
  return [
    "GLASS GUARDIAN SERVICE WAIVER (v1)",
    "",
    `Service: ${String(appt?.service_type ?? "")
      .replace(/_/g, " ")
      .toUpperCase()}`,
    `Appointment ID: ${String(appt?.id ?? "").slice(0, 8)}`,
    "",
    "I acknowledge that Glass Guardian will be working on my vehicle.",
    "Windshield repair is structural, not cosmetic.",
    "There is a risk of crack-out during repair.",
    "If a crack-out occurs during repair, the repair fee will be refunded.",
    "",
    "By signing below, I accept these terms.",
  ].join("\n");
}

/**
 * Parse appointment scheduled_date + scheduled_time_start into a local Date.
 * Supports:
 * - scheduled_date as ISO (contains "T") -> used as-is
 * - scheduled_date as YYYY-MM-DD and scheduled_time_start as:
 *   - "HH:mm" (24h)
 *   - "h:mm AM/PM"
 *   - "h AM/PM"
 */
export function parseScheduledStart(appt: AnyObj): Date | null {
  const rawDate = appt?.scheduled_date ? String(appt.scheduled_date) : "";
  if (!rawDate) return null;

  // If scheduled_date already has a time, trust it.
  if (rawDate.includes("T")) {
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? null : d;
  }

  // Otherwise combine YYYY-MM-DD with scheduled_time_start.
  const day = rawDate.slice(0, 10);
  const rawTime = appt?.scheduled_time_start
    ? String(appt.scheduled_time_start).trim()
    : "";

  // Default to 9:00 AM if time missing
  let hh = 9;
  let mm = 0;

  if (rawTime) {
    // 24h HH:mm
    const m24 = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
      hh = Math.min(23, Math.max(0, parseInt(m24[1], 10)));
      mm = Math.min(59, Math.max(0, parseInt(m24[2], 10)));
    } else {
      // 12h h(:mm)? AM/PM
      const m12 = rawTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const mins = m12[2] ? parseInt(m12[2], 10) : 0;
        const ap = String(m12[3]).toUpperCase();
        h = Math.min(12, Math.max(1, h));
        hh = h % 12;
        if (ap === "PM") hh += 12;
        mm = Math.min(59, Math.max(0, mins));
      }
    }
  }

  const combined = new Date(
    `${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(
      2,
      "0"
    )}:00`
  );
  return isNaN(combined.getTime()) ? null : combined;
}

/**
 * Waiver rules:
 * - User can ALWAYS review ahead of time.
 * - User can SIGN only on the day of service (local time), starting at 12:00 AM,
 *   until end of day (11:59 PM).
 * - If appointment is cancelled, signing is disabled.
 */
export function getWaiverSigningWindow(appt: AnyObj) {
  const status = String(appt?.status ?? "").toLowerCase();
  const scheduledStart = parseScheduledStart(appt);

  if (status === "cancelled") {
    return {
      hasSchedule: !!scheduledStart,
      canSignNow: false,
      reason:
        "This appointment is cancelled — waiver signing is disabled for cancelled jobs.",
      dayStart: null as Date | null,
      dayEnd: null as Date | null,
      scheduledStart,
    };
  }

  if (!scheduledStart) {
    return {
      hasSchedule: false,
      canSignNow: false,
      reason:
        "Waiver signing will be available on the day of service once the appointment is scheduled.",
      dayStart: null as Date | null,
      dayEnd: null as Date | null,
      scheduledStart: null as Date | null,
    };
  }

  const now = new Date();

  const dayStart = new Date(scheduledStart);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(scheduledStart);
  dayEnd.setHours(23, 59, 59, 999);

  const canSignNow =
    now.getTime() >= dayStart.getTime() && now.getTime() <= dayEnd.getTime();

  const reason = canSignNow
    ? null
    : `You can sign this waiver on the day of your appointment (${format(
        dayStart,
        "EEEE, MMMM d"
      )}).`;

  return { hasSchedule: true, canSignNow, reason, dayStart, dayEnd, scheduledStart };
}

/** ---------------------------------------------------------
 *  Crack-out helpers
 *  --------------------------------------------------------- */
export function isCrackOut(appt: AnyObj) {
  const outcome = String(appt?.repair_outcome ?? "").toLowerCase();
  return appt?.crack_out_occurred === true || outcome === "crack_out";
}

export function crackOutSummary(appt: AnyObj) {
  const cause = appt?.crack_out_cause ? String(appt.crack_out_cause) : null;
  const notes = appt?.crack_out_notes ? String(appt.crack_out_notes) : null;

  const occurredAt =
    appt?.crack_out_at && String(appt?.crack_out_at).includes("T")
      ? String(appt.crack_out_at).split("T")[0]
      : appt?.crack_out_at
      ? String(appt.crack_out_at)
      : appt?.scheduled_date
      ? String(appt.scheduled_date)
      : null;

  return { cause, notes, occurredAt };
}

/** ---------------------------------------------------------
 *  Status visuals (badge + main card)
 *  --------------------------------------------------------- */
export function getStatusVisuals(status?: string) {
  const normalized = (status ?? "").toLowerCase();

  const baseCard =
    "border bg-slate-950/80 shadow-[0_18px_45px_rgba(15,23,42,0.9)]";
  const baseBadge =
    "rounded-full px-4 py-2 text-base font-semibold uppercase tracking-wide border";

  const map: Record<string, { card: string; badge: string }> = {
    requested: {
      card: `${baseCard} border-amber-400/60 bg-gradient-to-br from-slate-950 via-amber-950/30 to-slate-900 shadow-[0_0_40px_rgba(251,191,36,0.35)]`,
      badge: `${baseBadge} border-amber-400/70 text-amber-100 bg-amber-500/15 shadow-[0_0_16px_rgba(251,191,36,0.45)]`,
    },
    estimating: {
      card: `${baseCard} border-sky-400/60 bg-gradient-to-br from-slate-950 via-sky-950/30 to-slate-900 shadow-[0_0_40px_rgba(56,189,248,0.4)]`,
      badge: `${baseBadge} border-sky-400/70 text-sky-100 bg-sky-500/15 shadow-[0_0_16px_rgba(56,189,248,0.55)]`,
    },
    estimate_sent: {
      card: `${baseCard} border-sky-400/60 bg-gradient-to-br from-slate-950 via-sky-950/25 to-slate-900 shadow-[0_0_40px_rgba(56,189,248,0.4)]`,
      badge: `${baseBadge} border-sky-300/80 text-sky-100 bg-sky-500/20 shadow-[0_0_16px_rgba(59,130,246,0.5)]`,
    },
    approved: {
      card: `${baseCard} border-emerald-400/60 bg-gradient-to-br from-slate-950 via-emerald-950/25 to-slate-900 shadow-[0_0_40px_rgba(16,185,129,0.45)]`,
      badge: `${baseBadge} border-emerald-400/80 text-emerald-100 bg-emerald-500/20 shadow-[0_0_16px_rgba(16,185,129,0.6)]`,
    },
    scheduled: {
      card: `${baseCard} border-violet-400/60 bg-gradient-to-br from-slate-950 via-violet-950/25 to-slate-900 shadow-[0_0_40px_rgba(139,92,246,0.5)]`,
      badge: `${baseBadge} border-violet-400/80 text-violet-100 bg-violet-500/20 shadow-[0_0_16px_rgba(139,92,246,0.65)]`,
    },
    en_route: {
      card: `${baseCard} border-orange-400/70 bg-gradient-to-br from-slate-950 via-orange-950/25 to-slate-900 shadow-[0_0_45px_rgba(249,115,22,0.55)]`,
      badge: `${baseBadge} border-orange-400/80 text-orange-50 bg-orange-500/25 shadow-[0_0_18px_rgba(249,115,22,0.7)]`,
    },
    on_site: {
      card: `${baseCard} border-indigo-400/70 bg-gradient-to-br from-slate-950 via-indigo-950/25 to-slate-900 shadow-[0_0_45px_rgba(79,70,229,0.55)]`,
      badge: `${baseBadge} border-indigo-400/80 text-indigo-50 bg-indigo-500/25 shadow-[0_0_18px_rgba(79,70,229,0.7)]`,
    },
    in_progress: {
      card: `${baseCard} border-cyan-400/70 bg-gradient-to-br from-slate-950 via-cyan-950/25 to-slate-900 shadow-[0_0_45px_rgba(6,182,212,0.6)]`,
      badge: `${baseBadge} border-cyan-400/80 text-cyan-50 bg-cyan-500/25 shadow-[0_0_18px_rgba(6,182,212,0.75)]`,
    },
    curing: {
      card: `${baseCard} border-fuchsia-400/70 bg-gradient-to-br from-slate-950 via-fuchsia-950/25 to-slate-900 shadow-[0_0_45px_rgba(217,70,239,0.6)]`,
      badge: `${baseBadge} border-fuchsia-400/80 text-fuchsia-50 bg-fuchsia-500/25 shadow-[0_0_18px_rgba(217,70,239,0.75)]`,
    },
    completed: {
      card: `${baseCard} border-emerald-400/70 bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-900 shadow-[0_0_40px_rgba(16,185,129,0.55)]`,
      badge: `${baseBadge} border-emerald-300/80 text-emerald-50 bg-emerald-500/25 shadow-[0_0_18px_rgba(16,185,129,0.8)]`,
    },
    paid: {
      card: `${baseCard} border-emerald-300/80 bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-900 shadow-[0_0_42px_rgba(16,185,129,0.7)]`,
      badge: `${baseBadge} border-emerald-300/80 text-emerald-50 bg-emerald-500/25 shadow-[0_0_18px_rgba(16,185,129,0.85)]`,
    },
    cancelled: {
      card: `${baseCard} border-red-500/60 bg-gradient-to-br from-slate-950 via-red-950/30 to-slate-900 shadow-[0_0_40px_rgba(248,113,113,0.55)]`,
      badge: `${baseBadge} border-red-500/80 text-red-100 bg-red-500/20 shadow-[0_0_18px_rgba(248,113,113,0.9)]`,
    },
  };

  return (
    map[normalized] ?? {
      card: `${baseCard} border-slate-800/80 bg-slate-950/80`,
      badge: `${baseBadge} border-slate-600/70 text-slate-100 bg-slate-800/60`,
    }
  );
}

/** ---------------------------------------------------------
 *  Billing meta (estimate → approved → completed → paid)
 *  --------------------------------------------------------- */
export function getBillingMeta(appointment: AnyObj) {
  const status = String(appointment.status ?? "").toLowerCase();
  const paymentStatus = String(appointment.payment_status ?? "").toLowerCase();

  const invoiceTotal =
    typeof appointment.invoice_total === "number"
      ? appointment.invoice_total
      : undefined;
  const amountPaid =
    typeof appointment.amount_paid === "number"
      ? appointment.amount_paid
      : undefined;

  const estimateAmount =
    typeof appointment.estimate_amount === "number"
      ? appointment.estimate_amount
      : undefined;
  const finalAmount =
    typeof appointment.final_amount === "number"
      ? appointment.final_amount
      : undefined;

  const amount = invoiceTotal ?? finalAmount ?? estimateAmount;

  type Phase =
    | "estimate"
    | "awaiting_approval"
    | "approved"
    | "completed"
    | "paid"
    | "cancelled";

  let phase: Phase = "estimate";

  if (status === "cancelled") {
    phase = "cancelled";
  } else if (
    paymentStatus === "paid" ||
    status === "paid" ||
    (amountPaid && invoiceTotal && amountPaid >= invoiceTotal)
  ) {
    phase = "paid";
  } else if (status === "completed") {
    phase = "completed";
  } else if (
    status === "approved" ||
    ["scheduled", "en_route", "on_site", "in_progress", "curing"].includes(
      status
    )
  ) {
    phase = "approved";
  } else if (["estimating", "estimate_sent"].includes(status)) {
    phase = "awaiting_approval";
  } else {
    phase = "estimate";
  }

  let heading = "Estimate";
  let chip = "Estimate";
  let subtitle = "Initial estimate for your repair.";

  switch (phase) {
    case "awaiting_approval":
      heading = "Estimate Pending Approval";
      chip = "Pending Approval";
      subtitle = "Review and approve your estimate to lock in pricing.";
      break;
    case "approved":
      heading = "Approved Estimate";
      chip = "Approved";
      subtitle = "Your estimate is approved and tied to this appointment.";
      break;
    case "completed":
      heading = "Final Amount";
      chip = "Completed";
      subtitle = "Service completed — final total shown.";
      break;
    case "paid":
      heading = "Paid in Full";
      chip = "Paid";
      subtitle = "Thanks — your payment has been received.";
      break;
    case "cancelled":
      heading = "Appointment Cancelled";
      chip = "Cancelled";
      subtitle = "This appointment was cancelled. No charges are due.";
      break;
  }

  const cardClassByPhase: Record<Phase, string> = {
    estimate:
      "border-none shadow-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white",
    awaiting_approval:
      "border-none shadow-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white",
    approved:
      "border-none shadow-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
    completed:
      "border-none shadow-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white",
    paid:
      "border-none shadow-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-amber-400 text-white",
    cancelled:
      "border-none shadow-2xl bg-gradient-to-br from-red-600 via-red-700 to-slate-900 text-white",
  };

  const hasAmount = phase === "cancelled" ? false : typeof amount === "number";

  return {
    hasAmount,
    amount: hasAmount && typeof amount === "number" ? amount : null,
    heading,
    chip,
    subtitle,
    phase,
    cardClass: cardClassByPhase[phase],
  };
}