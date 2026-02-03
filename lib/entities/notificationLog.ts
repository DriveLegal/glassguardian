// lib/entities/notificationLog.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const NotificationLogSchema = z.object({
  id: z.string().uuid().optional(),
  recipient_email: z.string(),
  notification_type: z.enum([
    "appointment_booked",
    "estimate_ready",
    "appointment_approved",
    "tech_en_route",
    "tech_arrived",
    "repair_started",
    "repair_curing",
    "repair_completed",
    "warranty_issued",
    "payment_received",
    "insurance_claim_filed",
    "insurance_claim_approved",
  ]),
  appointment_id: z.string().optional(),
  claim_id: z.string().optional(),
  subject: z.string(),
  message: z.string(),
  delivery_method: z.enum(["email", "sms", "push"]).default("email"),
  status: z.enum(["sent", "delivered", "failed"]).default("sent"),
  sent_at: z.string().optional(), // datetime
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type NotificationLog = z.infer<typeof NotificationLogSchema>;
export const NotificationLogModel =
  createCRUDHelper<NotificationLog>("notification_logs");