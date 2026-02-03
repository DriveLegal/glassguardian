// lib/entities/techAvailability.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const TechAvailabilitySchema = z.object({
  id: z.string().uuid().optional(),
  technician_email: z.string(),
  date: z.string(), // date
  start_time: z.string(), // HH:MM
  end_time: z.string(),   // HH:MM
  is_available: z.boolean().default(true).optional(),
  notes: z.string().optional(),
  zone: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type TechAvailability = z.infer<typeof TechAvailabilitySchema>;
export const TechAvailabilityModel =
  createCRUDHelper<TechAvailability>("tech_availability");