// lib/entities/coupon.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const CouponSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string(),
  discount_type: z.enum(["percentage", "fixed_amount"]),
  discount_value: z.number(),
  min_purchase: z.number().default(0).optional(),
  max_uses: z.number().optional(),
  times_used: z.number().default(0).optional(),
  valid_from: z.string().optional(), // date
  valid_until: z.string().optional(), // date
  is_active: z.boolean().default(true).optional(),
  applicable_services: z.array(z.string()).default([]).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Coupon = z.infer<typeof CouponSchema>;
export const CouponModel = createCRUDHelper<Coupon>("coupons");