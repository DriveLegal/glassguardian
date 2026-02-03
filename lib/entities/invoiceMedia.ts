// lib/entities/invoiceMedia.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const InvoiceMediaSchema = z.object({
  id: z.string().uuid().optional(),
  invoice_id: z.string(),
  category: z.enum(["panels", "vehicle", "interior", "wheel", "misc", "windshield"]),
  label: z.string().optional(), // e.g., LT FENDER, HOOD, WINDSHIELD
  file_url: z.string(),
  uploaded_by: z.string().optional(),
  timestamp: z.string().optional(), // datetime
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type InvoiceMedia = z.infer<typeof InvoiceMediaSchema>;
export const InvoiceMediaModel =
  createCRUDHelper<InvoiceMedia>("invoice_media");