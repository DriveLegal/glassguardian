// lib/entities/insuranceClaim.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const InsuranceClaimSchema = z.object({
  id: z.string().uuid().optional(),
  appointment_id: z.string().optional(),
  customer_email: z.string(),
  vehicle_id: z.string(),
  claim_number: z.string().optional(),
  insurance_carrier: z.string(),
  policy_number: z.string(),
  deductible_amount: z.number().optional(),
  claim_amount: z.number().optional(),
  approved_amount: z.number().optional(),
  status: z
    .enum(["draft", "submitted", "pending_review", "approved", "denied", "paid"])
    .default("draft"),
  submitted_date: z.string().optional(), // datetime
  approval_date: z.string().optional(), // datetime
  denial_reason: z.string().optional(),
  adjuster_name: z.string().optional(),
  adjuster_phone: z.string().optional(),
  adjuster_email: z.string().optional(),
  claim_documents: z.array(z.string()).default([]).optional(),
  notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type InsuranceClaim = z.infer<typeof InsuranceClaimSchema>;
export const InsuranceClaimModel =
  createCRUDHelper<InsuranceClaim>("insurance_claims");