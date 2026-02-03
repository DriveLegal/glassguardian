// components/AutomatedNotifications.ts
"use client";

import { supabaseClient } from "@/lib/supabaseClient";

export type NotificationPayload = {
  recipientEmail: string;
  notificationType:
    | "appointment_booked"
    | "tech_arrived"
    | "repair_started"
    | "repair_curing"
    | "repair_completed"
    | "warranty_issued"
    | string;
  appointmentId?: string | null;
  customData?: Record<string, any>;
};

function isMissingTableError(err: any) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();
  return code === "PGRST205" || msg.includes("schema cache");
}

function buildCopy(type: string) {
  switch (type) {
    case "appointment_booked":
      return {
        title: "Appointment requested",
        body: "We got your request. A technician will review it shortly.",
        kind: "info",
      };
    case "tech_arrived":
      return {
        title: "Technician arrived",
        body: "Your technician is on-site and ready to begin.",
        kind: "success",
      };
    case "repair_started":
      return {
        title: "Repair started",
        body: "Your repair has started.",
        kind: "info",
      };
    case "repair_curing":
      return {
        title: "Curing in progress",
        body: "Resin is curing—almost done.",
        kind: "info",
      };
    case "repair_completed":
      return {
        title: "Repair completed",
        body: "Your repair is complete. Thanks for choosing Glass Guardian.",
        kind: "success",
      };
    case "warranty_issued":
      return {
        title: "Warranty issued",
        body: "Your warranty has been issued and is now available in your portal.",
        kind: "success",
      };
    default:
      return {
        title: "Update",
        body: "You have a new update in your portal.",
        kind: "info",
      };
  }
}

/**
 * Lightweight client-side notifier.
 * - Soft-fails (never throws)
 * - Writes BOTH the in-app notification fields + audit fields your table supports
 *
 * IMPORTANT:
 * Your notifications.user_id FK points to app_users.auth_user_id,
 * so user_id MUST be the auth user's id (auth.uid()).
 */
export const NotificationService = {
  async sendNotification({
    recipientEmail,
    notificationType,
    appointmentId = null,
    customData = {},
  }: NotificationPayload): Promise<void> {
    try {
      // Get auth user id (required for FK: notifications.user_id -> app_users.auth_user_id)
      const { data: sessionData, error: sessionErr } =
        await supabaseClient.auth.getSession();

      if (sessionErr) {
        console.warn("[NotificationService] getSession failed:", sessionErr);
        return;
      }

      const authUserId = sessionData?.session?.user?.id ?? null;

      // If user_id is NOT NULL (common), skip safely when not authenticated.
      if (!authUserId) {
        // still soft-fail: don't break UX
        console.warn("[NotificationService] no auth user id; skipping notification");
        return;
      }

      const copy = buildCopy(notificationType);

      const insertRow = {
        // ✅ FK-backed user pointer
        user_id: authUserId,

        // in-app fields
        title: copy.title,
        body: copy.body,
        type: copy.kind,
        read: false,

        // audit/automation fields
        recipient_email: recipientEmail,
        notification_type: notificationType,
        appointment_id: appointmentId,
        payload: customData,

        // timestamps (let DB defaults handle these if you have them,
        // but sending them is fine if your schema allows)
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient.from("notifications").insert(insertRow);

      if (error) {
        if (isMissingTableError(error)) return; // silent if table missing / cache issue
        console.warn("[NotificationService] insert failed:", error);
      }
    } catch (err: any) {
      console.warn("[NotificationService] unexpected error:", err?.message || err);
    }
  },
};