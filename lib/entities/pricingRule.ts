// lib/entities/pricingRule.ts
import { z } from "zod";
import { createCRUDHelper } from "@/lib/dbHelpers";

export const PricingRuleSchema = z.object({
  id: z.string().uuid().optional(),
  service_type: z.enum(["chip_repair", "crack_repair", "replacement", "inspection"]),
  damage_size: z.enum(["quarter", "half_dollar", "dollar", "larger", "any"]).optional(),
  base_price: z.number(),
  mobile_surcharge: z.number().default(0).optional(),
  rush_surcharge: z.number().default(0).optional(),
  description: z.string().optional(),
  is_active: z.boolean().default(true).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type PricingRule = z.infer<typeof PricingRuleSchema>;
export const PricingRuleModel = createCRUDHelper<PricingRule>("pricing_rules");