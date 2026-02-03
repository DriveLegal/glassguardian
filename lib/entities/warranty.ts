// lib/entities/warranty.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const WarrantySchema = z.object({
  id: z.string().uuid().optional(),
  appointment_id: z.string(),
  customer_email: z.string(),
  vehicle_id: z.string(),
  warranty_number: z.string(),
  service_performed: z.string().optional(),
  service_date: z.string().optional(), // date
  expiration_date: z.string().optional(), // date
  terms_version: z.string().default("1.0").optional(),
  coverage_type: z.enum(["lifetime", "1_year", "6_months"]).default("lifetime"),
  status: z
    .enum(["active", "claimed", "expired", "transferred", "voided"])
    .default("active"),
  claim_filed_date: z.string().optional(), // date
  claim_resolution: z.string().optional(),
  transferred_to_email: z.string().optional(),
  qr_code_url: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Warranty = z.infer<typeof WarrantySchema>;
export const WarrantyModel = createCRUDHelper<Warranty>("warranties");