// lib/entities/techInvoice.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const TechInvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  invoice_number: z.string(),
  technician_email: z.string(),
  client_id: z.string(),
  vehicle_id: z.string().optional(),
  invoice_date: z.string().optional(), // date
  status: z.enum(["draft", "completed", "paid"]).default("draft"),
  services: z.object({
    rni_rnr_total: z.number().default(0).optional(),
    parts_total: z.number().default(0).optional(),
    glass_total: z.number().default(0).optional(),
    misc_total: z.number().default(0).optional(),
  }).optional(),
  windshield_repairs: z.array(z.object({
    quadrant: z.string().optional(),
    damage_type: z.enum(["bullseye", "combo", "crack", "half_moon", "star", "pit"]),
    crack_length_inches: z.number().optional(),
    notes: z.string().optional(),
    is_previous_repair: z.boolean().default(false).optional(),
  })).default([]).optional(),
  subtotal: z.number().optional(),
  discount_percent: z.number().default(0).optional(),
  discount_amount: z.number().default(0).optional(),
  tax_rate: z.number().default(0).optional(),
  tax_amount: z.number().default(0).optional(),
  total_amount: z.number().optional(),
  payment_method: z.enum([
    "credit_card",
    "check",
    "offline_credit_card",
    "cash",
    "other",
  ]).optional(),
  payment_note: z.string().optional(),
  payment_evidence_url: z.string().optional(),
  customer_signature: z.string().optional(), // data URL
  is_scheduled: z.boolean().default(false).optional(),
  scheduled_date: z.string().optional(), // datetime
  assigned_techs: z.array(z.string()).default([]).optional(),
  tech_pay_amount: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type TechInvoice = z.infer<typeof TechInvoiceSchema>;
export const TechInvoiceModel = createCRUDHelper<TechInvoice>("tech_invoices");