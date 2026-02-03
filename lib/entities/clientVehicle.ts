// lib/entities/clientVehicle.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const ClientVehicleSchema = z.object({
  id: z.string().uuid().optional(),
  client_id: z.string(),
  year: z.number(),
  make: z.string(),
  model: z.string(),
  color: z.string().optional(),
  vin: z.string().optional(),
  stock_ro: z.string().optional(),
  license_plate: z.string().optional(),
  license_state: z.string().optional(),
  vehicle_type: z.enum(["car", "truck", "suv", "van"]).default("car"),
  trim: z.string().optional(),
  engine: z.string().optional(),
  doors: z.number().optional(),
  odometer: z.number().optional(),
  fuel_level: z.enum(["empty", "quarter", "half", "three_quarter", "full"]).optional(),
  interior_color: z.string().optional(),
  key_tag: z.string().optional(),
  production_date: z.string().optional(), // date
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ClientVehicle = z.infer<typeof ClientVehicleSchema>;
export const ClientVehicleModel =
  createCRUDHelper<ClientVehicle>("client_vehicles");