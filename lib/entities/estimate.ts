// lib/entities/estimate.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const EstimateSchema = z.object({
  id: z.string().uuid().optional(),
  appointment_id: z.string(),
  customer_email: z.string(),
  service_type: z.enum(["chip_repair", "crack_repair", "replacement", "inspection"]),
  damage_assessment: z.string().optional(),
  estimated_amount: z.number(),
  labor_cost: z.number().optional(),
  parts_cost: z.number().optional(),
  additional_fees: z.number().default(0).optional(),
  status: z.enum(["draft", "pending_review", "sent", "approved", "rejected", "expired"]).default("draft"),
  reviewed_by: z.string().optional(),
  sent_date: z.string().optional(),     // datetime
  approved_date: z.string().optional(), // datetime
  expires_date: z.string().optional(),  // datetime
  notes_admin: z.string().optional(),
  notes_customer: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Estimate = z.infer<typeof EstimateSchema>;
export const EstimateModel = createCRUDHelper<Estimate>("estimates");