// lib/entities/client.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const ClientSchema = z.object({
  id: z.string().uuid().optional(),
  created_by_tech: z.string(),
  full_name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Client = z.infer<typeof ClientSchema>;
export const ClientModel = createCRUDHelper<Client>("clients");