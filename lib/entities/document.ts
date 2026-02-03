// lib/entities/document.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const DocumentSchema = z.object({
  id: z.string().uuid().optional(),
  owner_email: z.string(),
  document_type: z.enum([
    "insurance_card",
    "insurance_policy",
    "warranty",
    "invoice",
    "receipt",
    "claim",
    "other",
  ]),
  title: z.string(),
  description: z.string().optional(),
  file_url: z.string(),
  file_type: z.string().optional(), // MIME
  file_size: z.number().optional(), // bytes
  appointment_id: z.string().optional(),
  vehicle_id: z.string().optional(),
  expiry_date: z.string().optional(), // date
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;
export const DocumentModel = createCRUDHelper<Document>("documents");