// lib/entities/review.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const ReviewSchema = z.object({
  id: z.string().uuid().optional(),
  appointment_id: z.string(),
  customer_email: z.string(),
  technician_email: z.string().optional(),
  rating: z.number().min(1).max(5),
  service_rating: z.number().min(1).max(5).optional(),
  professionalism_rating: z.number().min(1).max(5).optional(),
  timeliness_rating: z.number().min(1).max(5).optional(),
  comment: z.string().optional(),
  would_recommend: z.boolean().optional(),
  is_public: z.boolean().default(true).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Review = z.infer<typeof ReviewSchema>;
export const ReviewModel = createCRUDHelper<Review>("reviews");