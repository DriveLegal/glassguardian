// lib/entities/insurancePartner.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const InsurancePartnerSchema = z.object({
  id: z.string().uuid().optional(),
  company_name: z.string(),
  partner_code: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string(),
  contact_phone: z.string().optional(),
  portal_access_email: z.string().optional(),
  api_key: z.string().optional(),
  is_active: z.boolean().default(true),
  auto_approve_limit: z.number().default(0).optional(),
  preferred_notification_method: z
    .enum(["email", "api", "both"])
    .default("email"),
  notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type InsurancePartner = z.infer<typeof InsurancePartnerSchema>;
export const InsurancePartnerModel =
  createCRUDHelper<InsurancePartner>("insurance_partners");