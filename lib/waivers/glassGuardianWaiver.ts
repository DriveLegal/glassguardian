// lib/waivers/glassGuardianWaiver.ts

export const WAIVER_VERSION = "v1.1-2026-01-12";

export type GlassGuardianWaiverInput = {
  repairAmount?: number;

  // Optional details (safe to ignore if you want to keep it simple)
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;

  vehicleYear?: string | number | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleVin?: string | null;

  serviceAddress?: string | null;
  appointmentDateISO?: string | null; // e.g. 2026-01-12
  appointmentTimeLabel?: string | null; // e.g. 2:30 PM
  timeZone?: string | null; // e.g. America/Los_Angeles
};

function safe(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Backwards compatible:
 * - buildGlassGuardianWaiverText(60)
 * - buildGlassGuardianWaiverText({ repairAmount: 60, customerName: "..." })
 */
export function buildGlassGuardianWaiverText(
  arg: number | GlassGuardianWaiverInput = 60
) {
  const input: GlassGuardianWaiverInput =
    typeof arg === "number" ? { repairAmount: arg } : arg || {};

  const repairAmount =
    typeof input.repairAmount === "number" && Number.isFinite(input.repairAmount)
      ? Math.max(0, Math.round(input.repairAmount))
      : 60;

  const customerName = safe(input.customerName);
  const customerEmail = safe(input.customerEmail);
  const customerPhone = safe(input.customerPhone);

  const vehicleYear = safe(input.vehicleYear);
  const vehicleMake = safe(input.vehicleMake);
  const vehicleModel = safe(input.vehicleModel);
  const vehicleVin = safe(input.vehicleVin);

  const serviceAddress = safe(input.serviceAddress);
  const appointmentDateISO = safe(input.appointmentDateISO);
  const appointmentTimeLabel = safe(input.appointmentTimeLabel);
  const timeZone = safe(input.timeZone) || "America/Los_Angeles";

  const vehicleLine =
    [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(" ") || "";

  const scheduleLine =
    [appointmentDateISO, appointmentTimeLabel].filter(Boolean).join(" • ") || "";

  // Optional header block only if any detail exists
  const detailsBlock =
    customerName ||
    customerEmail ||
    customerPhone ||
    vehicleLine ||
    vehicleVin ||
    serviceAddress ||
    scheduleLine
      ? `\nCUSTOMER / VEHICLE (Optional)
Name: ${customerName || "—"}
Email: ${customerEmail || "—"}
Phone: ${customerPhone || "—"}

Vehicle: ${vehicleLine || "—"}
VIN: ${vehicleVin || "—"}

Service Address: ${serviceAddress || "—"}
Appointment: ${scheduleLine || "—"}
Time Zone: ${timeZone}
`
      : "";

  return `GLASS GUARDIAN – DAY-OF SERVICE WAIVER (${WAIVER_VERSION})${detailsBlock}

By signing/initialing below, I acknowledge and agree:

1) Authorization to Work
I authorize Glass Guardian Chip & Crack Repair (“Glass Guardian”) to perform windshield repair services on my vehicle.
I confirm I am the vehicle owner or I have authority to approve this work.

2) Structural vs Cosmetic (What this repair is / isn’t)
I understand windshield repair is primarily a structural improvement intended to stabilize damage and help prevent spreading.
I understand the repair may not be cosmetically perfect and visible imperfections may remain.

3) Known Risk: Damage Can Spread (Before, During, or After Service)
I understand that glass damage can change due to existing stress, temperature changes (hot/cold fluctuations), road vibration,
vehicle body flex, moisture, and/or hidden micro-fractures. Even with proper technique, a crack may spread.

4) If Repair Fails During the Repair Attempt
If the repair fails during the repair process and Glass Guardian cannot complete the repair, I will receive a refund of the repair
amount ($${repairAmount}). This refund is limited to the amount paid for the repair service itself.

5) Limitation of Liability (Pre-existing / hidden damage)
I release Glass Guardian from liability for pre-existing glass stress, hidden damage, or spreading that occurs before, during, or after
service, except where prohibited by law.

6) Documentation
I authorize Glass Guardian to photograph the damage and completed repair for documentation and warranty purposes.

7) Questions / Consent
If I have any questions, I will ask before service begins. I confirm the information I provide is accurate and I am signing this waiver
on the day of my appointment.

Customer Signature: _______________________________   Date: _______________
Customer Printed Name: ____________________________`;
}