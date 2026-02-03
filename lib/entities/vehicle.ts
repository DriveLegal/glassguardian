// lib/entities/vehicle.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const VehicleSchema = z.object({
  id: z.string().uuid().optional(),
  owner_email: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number(),
  color: z.string().optional(),
  vin: z.string().optional(),
  license_plate: z.string().optional(),
  insurance_carrier: z.string().optional(),
  insurance_policy: z.string().optional(),
  is_default: z.boolean().default(false).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;
export const VehicleModel = createCRUDHelper<Vehicle>("vehicles");