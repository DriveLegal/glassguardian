// lib/entities/invoice.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total: z.number().optional(), // can be computed client/server-side
});

export const InvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  appointment_id: z.string().optional(),
  customer_email: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(), // date
  line_items: z.array(LineItemSchema).default([]),
  subtotal: z.number().optional(),
  tax_rate: z.number().optional(),
  tax_amount: z.number().optional(),
  tip_amount: z.number().default(0).optional(),
  discount_amount: z.number().default(0).optional(),
  total_amount: z.number(),
  payment_status: z
    .enum(["pending", "partial", "paid", "refunded", "failed"])
    .default("pending"),
  payment_method: z.string().optional(),
  payment_date: z.string().optional(), // datetime
  stripe_payment_id: z.string().optional(),
  refund_amount: z.number().default(0).optional(),
  notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export const InvoiceModel = createCRUDHelper<Invoice>("invoices");