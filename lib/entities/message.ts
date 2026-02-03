// lib/entities/message.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const MessageSchema = z.object({
  id: z.string().uuid().optional(),
  appointment_id: z.string().optional(),
  sender_email: z.string(),
  sender_role: z.enum(["customer", "technician", "admin"]).optional(),
  recipient_email: z.string().optional(),
  message_type: z.enum(["chat", "support", "system"]).default("chat"),
  subject: z.string().optional(),
  body: z.string(),
  attachments: z.array(z.string()).default([]).optional(),
  is_read: z.boolean().default(false).optional(),
  read_at: z.string().optional(), // datetime
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;
export const MessageModel = createCRUDHelper<Message>("messages");