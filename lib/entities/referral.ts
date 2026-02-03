// lib/entities/referral.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const ReferralSchema = z.object({
  id: z.string().uuid().optional(),
  referrer_email: z.string(),
  referred_email: z.string(),
  referral_code: z.string(),
  status: z.enum(["pending", "completed", "credited"]).default("pending"),
  credit_amount: z.number().default(25).optional(),
  first_appointment_id: z.string().optional(),
  credited_date: z.string().optional(), // datetime
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Referral = z.infer<typeof ReferralSchema>;
export const ReferralModel = createCRUDHelper<Referral>("referrals");