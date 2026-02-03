// lib/entities/photo.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const PhotoSchema = z.object({
  id: z.string().uuid().optional(),
  appointment_id: z.string(),
  photo_type: z.enum([
    "damage_closeup",
    "damage_with_coin",
    "damage_45_degree",
    "damage_interior",
    "full_windshield",
    "before_repair",
    "during_repair",
    "after_repair",
    "vehicle_context",
  ]),
  file_url: z.string(),
  uploaded_by: z.string().optional(),
  timestamp: z.string().optional(), // ISO datetime
  metadata: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      device: z.string().optional(),
    })
    .optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Photo = z.infer<typeof PhotoSchema>;
export const PhotoModel = createCRUDHelper<Photo>("photos");