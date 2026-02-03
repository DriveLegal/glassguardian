// lib/entities/appointment.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const AppointmentSchema = z.object({
  id: z.string().uuid().optional(),
  customer_email: z.string(),
  vehicle_id: z.string(),
  technician_email: z.string().optional(),
  service_type: z.enum(["chip_repair", "crack_repair", "replacement", "inspection"]),
  location_type: z.enum(["mobile", "shop"]).default("mobile"),
  service_address: z.string(),
  service_lat: z.number().optional(),
  service_lng: z.number().optional(),
  scheduled_date: z.string().optional(), // date (YYYY-MM-DD)
  scheduled_time_start: z.string().optional(), // HH:MM
  scheduled_time_end: z.string().optional(),   // HH:MM
  status: z.enum([
    "requested",
    "estimating",
    "estimate_sent",
    "approved",
    "scheduled",
    "en_route",
    "on_site",
    "in_progress",
    "curing",
    "completed",
    "paid",
    "cancelled",
    "warranty_active",
  ]).default("requested"),
  damage_description: z.string().optional(),
  damage_size: z.enum(["quarter", "half_dollar", "dollar", "larger"]).optional(),
  damage_location: z.string().optional(),
  estimate_amount: z.number().optional(),
  final_amount: z.number().optional(),
  deposit_amount: z.number().optional(),
  notes_customer: z.string().optional(),
  notes_tech: z.string().optional(),
  notes_internal: z.string().optional(),
  eta_minutes: z.number().optional(),
  actual_start_time: z.string().optional(), // datetime
  actual_end_time: z.string().optional(),   // datetime
  resin_type: z.string().optional(),
  resin_batch: z.string().optional(),
  cure_method: z.enum(["uv", "sunlight", "heat"]).optional(),
  cure_duration_minutes: z.number().optional(),
  requires_calibration: z.boolean().default(false).optional(),
  customer_signature: z.string().optional(), // data URL
  customer_rating: z.number().min(1).max(5).optional(),
  customer_review: z.string().optional(),
  warranty_id: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Appointment = z.infer<typeof AppointmentSchema>;
export const AppointmentModel = createCRUDHelper<Appointment>("appointments");