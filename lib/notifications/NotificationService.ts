// lib/notifications/NotificationService.ts
type SendArgs = {
  recipientEmail: string;
  notificationType:
    | "appointment_booked"
    | "estimate_ready"
    | "appointment_approved"
    | "tech_en_route"
    | "tech_arrived"
    | "repair_started"
    | "repair_curing"
    | "repair_completed"
    | "warranty_issued"
    | "payment_received"
    | "insurance_claim_filed"
    | "insurance_claim_approved";
  appointmentId?: string | null;
  claimId?: string | null;
  customData?: Record<string, any>;
};

const templates: Record<
  SendArgs["notificationType"],
  (a: SendArgs) => { subject: string; message: string }
> = {
  appointment_booked: (a) => ({
    subject: "✅ Appointment Confirmed - Glass Guardian",
    message: `Your windshield repair appointment has been confirmed! We'll review your photos and send you an estimate within 2 hours. Appointment ID: ${(a.appointmentId ?? "").toString().slice(0, 8)}`,
  }),
  estimate_ready: (a) => ({
    subject: "💰 Your Repair Estimate is Ready",
    message: `Great news! Your windshield repair estimate is ready: $${Number(a.customData?.amount ?? 0).toFixed(2)}. Review and approve your estimate to schedule your service.`,
  }),
  appointment_approved: (a) => ({
    subject: "🎉 Service Approved - Ready to Schedule",
    message: `Your repair has been approved! Total: $${Number(a.customData?.amount ?? 0).toFixed(2)}. Please schedule your service at your convenience.`,
  }),
  tech_en_route: (a) => ({
    subject: "🚗 Technician On the Way",
    message: `${a.customData?.techName ?? "Our tech"} is heading to your location! ETA: ${a.customData?.eta ?? "—"} minutes. Track their arrival in real-time.`,
  }),
  tech_arrived: (a) => ({
    subject: "📍 Technician Has Arrived",
    message: `${a.customData?.techName ?? "Technician"} has arrived at ${a.customData?.address ?? "your location"}. Your repair will begin shortly.`,
  }),
  repair_started: (a) => ({
    subject: "🔧 Repair In Progress",
    message: `Your windshield repair has started. Vehicle: ${a.customData?.vehicle ?? "your vehicle"}. Estimated completion: ${a.customData?.estimatedTime ?? "—"} minutes.`,
  }),
  repair_curing: (a) => ({
    subject: "⏱️ Repair Curing - Almost Done",
    message: `The repair is complete and now curing under UV light. Cure time remaining: ${a.customData?.cureTime ?? "—"} minutes.`,
  }),
  repair_completed: (a) => ({
    subject: "✨ Repair Complete - Lifetime Warranty Active!",
    message: `Congratulations! Your windshield repair is complete. Your lifetime warranty (${a.customData?.warrantyNumber ?? "—"}) is now active. Safe travels!`,
  }),
  warranty_issued: (a) => ({
    subject: "🛡️ Lifetime Warranty Certificate",
    message: `Your lifetime warranty certificate is ready! Warranty #${a.customData?.warrantyNumber ?? "—"}. Download it anytime from your dashboard.`,
  }),
  payment_received: (a) => ({
    subject: "💳 Payment Confirmed",
    message: `Thank you! We've received your payment of $${Number(a.customData?.amount ?? 0).toFixed(2)}. Receipt #${a.customData?.receiptNumber ?? "—"} has been sent to your email.`,
  }),
  insurance_claim_filed: (a) => ({
    subject: "📋 Insurance Claim Filed",
    message: `Your insurance claim #${a.customData?.claimNumber ?? "—"} has been filed with ${a.customData?.carrier ?? "your carrier"}. We'll notify you once it's reviewed.`,
  }),
  insurance_claim_approved: (a) => ({
    subject: "✅ Insurance Claim Approved!",
    message: `Great news! Your insurance claim #${a.customData?.claimNumber ?? "—"} has been approved for $${Number(a.customData?.approvedAmount ?? 0).toFixed(2)}. Payment will be processed within 5–7 business days.`,
  }),
};

export const NotificationService = {
  async sendNotification(args: SendArgs) {
    const t = templates[args.notificationType]?.(args);
    if (!t) return false;

    // Call server route (keeps API keys off the client)
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: args.recipientEmail,
          subject: t.subject,
          message: t.message,
          meta: {
            notificationType: args.notificationType,
            appointmentId: args.appointmentId ?? null,
            claimId: args.claimId ?? null,
            customData: args.customData ?? {},
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch (err) {
      console.error("Notification failed:", err);
      return false;
    }
  },
};

export function useNotificationService() {
  return { sendNotification: NotificationService.sendNotification };
}