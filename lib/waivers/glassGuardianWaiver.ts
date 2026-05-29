// lib/waivers/glassGuardianWaiver.ts

export const WAIVER_VERSION = "v1.1-2026-01-12";

export type GlassGuardianWaiverInput = {
  repairAmount?: number;

  customerName?: string | null;

  initials?: string | null;
  signatureName?: string | null;
  signedDateLabel?: string | null;
};

function safe(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export function buildGlassGuardianWaiverText(
  arg: number | GlassGuardianWaiverInput = 70
) {
  const input: GlassGuardianWaiverInput =
    typeof arg === "number" ? { repairAmount: arg } : arg || {};

  const repairAmount =
    typeof input.repairAmount === "number" && Number.isFinite(input.repairAmount)
      ? Math.max(0, Math.round(input.repairAmount))
      : 70;

  const customerName = safe(input.customerName);

  const initials = safe(input.initials).toUpperCase();
  const initialsLabel = initials || "____";

  const printedName = customerName || "____________________________";
  const signatureName = safe(input.signatureName) || "____________________________";
  const signedDateLabel = safe(input.signedDateLabel) || "______________";


  const detailsBlock =
    customerName || safe(input.signatureName)
      ? `\nCUSTOMER / VEHICLE
Name: ${customerName || "—"}
`
      : "";

  return `GLASS GUARDIAN – DAY-OF SERVICE WAIVER (${WAIVER_VERSION})${detailsBlock}

Quick check before we start:
Please read each section and initial beside it. This keeps everything clear, simple, and protected for both you and Glass Guardian.

1) Permission to Work                                      Initials: ${initialsLabel}
I give Glass Guardian Chip & Crack Repair permission to repair the windshield damage on my vehicle.
I confirm that I own the vehicle or have permission to approve this service.

2) What Windshield Repair Does                            Initials: ${initialsLabel}
I understand this repair is meant to strengthen and stabilize the damaged glass.
The goal is to help stop the damage from spreading, but the spot may still be slightly visible after repair.

3) Glass Can Be Unpredictable                             Initials: ${initialsLabel}
I understand windshield damage can spread because of heat, cold, road vibration, vehicle flex, moisture,
or hidden stress in the glass. Even when the repair is done correctly, a crack or chip can still move.

4) If the Repair Cannot Be Completed                      Initials: ${initialsLabel}
If the damage spreads during the repair and Glass Guardian cannot complete the service, I will receive a refund
of the repair amount paid ($${repairAmount}). This refund is limited to the repair service amount only.

5) Existing Glass Damage                                  Initials: ${initialsLabel}
I understand Glass Guardian is not responsible for pre-existing stress, hidden cracks, old damage, or spreading
that happens before, during, or after service, except where prohibited by law.

6) Photos for Documentation                               Initials: ${initialsLabel}
I allow Glass Guardian to take photos of the damage and completed repair.
These photos may be used for service records, quality review, and warranty documentation.

7) Final Consent                                          Initials: ${initialsLabel}
I had the chance to ask questions before service begins. I confirm the information I provided is accurate,
and I am signing this waiver on the day of my appointment.

Customer Printed Name: ${printedName}                       Date: ${signedDateLabel}`;
}