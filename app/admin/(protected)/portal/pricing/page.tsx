"use client";

import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Tag, Plus, Edit, DollarSign } from "lucide-react";

/** ---------- Types (align with your Supabase table columns) ---------- */
type PricingRule = {
  id: string;
  service_type: string;
  damage_size: string | null;
  base_price: number;
  mobile_surcharge: number | null;
  rush_surcharge: number | null;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Small helper to coerce numbers safely */
function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminPricingPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);

  const [formData, setFormData] = useState({
    service_type: "chip_repair",
    damage_size: "any",
    base_price: 0,
    mobile_surcharge: 0,
    rush_surcharge: 0,
    description: "",
    is_active: true,
  });

  /** ---------- Read (Supabase) ---------- */
  const { data: pricingRules = [], isLoading } = useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("pricing_rules")
        .select(
          "id, service_type, damage_size, base_price, mobile_surcharge, rush_surcharge, description, is_active, created_at, updated_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PricingRule[];
    },
    staleTime: 15_000,
  });

  /** ---------- Create ---------- */
  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const { error } = await supabaseClient.from("pricing_rules").insert([
        {
          service_type: payload.service_type,
          damage_size: payload.damage_size,
          base_price: toNum(payload.base_price),
          mobile_surcharge: toNum(payload.mobile_surcharge),
          rush_surcharge: toNum(payload.rush_surcharge),
          description: payload.description || null,
          is_active: !!payload.is_active,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      setDialogOpen(false);
      resetForm();
    },
  });

  /** ---------- Update ---------- */
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabaseClient
        .from("pricing_rules")
        .update({
          service_type: data.service_type,
          damage_size: data.damage_size,
          base_price: toNum(data.base_price),
          mobile_surcharge: toNum(data.mobile_surcharge),
          rush_surcharge: toNum(data.rush_surcharge),
          description: data.description || null,
          is_active: !!data.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      setDialogOpen(false);
      resetForm();
    },
  });

  /** ---------- UI helpers ---------- */
  const resetForm = () => {
    setFormData({
      service_type: "chip_repair",
      damage_size: "any",
      base_price: 0,
      mobile_surcharge: 0,
      rush_surcharge: 0,
      description: "",
      is_active: true,
    });
    setEditingRule(null);
  };

  const handleEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setFormData({
      service_type: rule.service_type || "chip_repair",
      damage_size: rule.damage_size || "any",
      base_price: rule.base_price ?? 0,
      mobile_surcharge: rule.mobile_surcharge ?? 0,
      rush_surcharge: rule.rush_surcharge ?? 0,
      description: rule.description || "",
      is_active: rule.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    const cleaned = {
      ...formData,
      base_price: toNum(formData.base_price),
      mobile_surcharge: toNum(formData.mobile_surcharge),
      rush_surcharge: toNum(formData.rush_surcharge),
    };
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: cleaned });
    } else {
      createMutation.mutate(cleaned);
    }
  };

  const SERVICE_TYPES = [
    { value: "chip_repair", label: "Chip Repair" },
    { value: "crack_repair", label: "Crack Repair" },
    { value: "replacement", label: "Full Replacement" },
    { value: "inspection", label: "Inspection" },
  ];

  const DAMAGE_SIZES = [
    { value: "quarter", label: "Quarter Size" },
    { value: "half_dollar", label: "Half Dollar" },
    { value: "dollar", label: "Dollar Coin" },
    { value: "larger", label: "Larger" },
    { value: "any", label: "Any Size" },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header + CTA */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Tag className="w-8 h-8 text-blue-600" />
              Pricing Management
            </h1>
            <p className="text-gray-600 mt-1">Configure service pricing and surcharges</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Pricing Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Edit Pricing Rule" : "Add New Pricing Rule"}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Service Type */}
                  <div>
                    <Label>Service Type *</Label>
                    <Select
                      value={formData.service_type}
                      onValueChange={(value) => setFormData((f) => ({ ...f, service_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Damage Size */}
                  <div>
                    <Label>Damage Size</Label>
                    <Select
                      value={formData.damage_size}
                      onValueChange={(value) => setFormData((f) => ({ ...f, damage_size: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any size" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAMAGE_SIZES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Base Price */}
                  <div>
                    <Label>Base Price * ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={String(formData.base_price)}
                      onChange={(e) => setFormData((f) => ({ ...f, base_price: toNum(e.target.value, 0) }))}
                      required
                    />
                  </div>

                  {/* Mobile Surcharge */}
                  <div>
                    <Label>Mobile Surcharge ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={String(formData.mobile_surcharge)}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, mobile_surcharge: toNum(e.target.value, 0) }))
                      }
                    />
                  </div>

                  {/* Rush Surcharge */}
                  <div>
                    <Label>Rush Surcharge ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={String(formData.rush_surcharge)}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, rush_surcharge: toNum(e.target.value, 0) }))
                      }
                    />
                  </div>

                  {/* Active */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <Label htmlFor="is_active" className="cursor-pointer">
                      Active
                    </Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked: any) => setFormData((f) => ({ ...f, is_active: checked }))}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Additional details about this pricing rule..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingRule ? "Update Rule" : "Create Rule"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Pricing Rules Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {isLoading && (
            <Card className="border-none shadow-lg">
              <CardContent className="p-6">Loading pricing rules…</CardContent>
            </Card>
          )}

          {!isLoading &&
            pricingRules.map((rule) => {
              const base = toNum(rule.base_price);
              const mobile = toNum(rule.mobile_surcharge);
              const rush = toNum(rule.rush_surcharge);

              return (
                <Card
                  key={rule.id}
                  className={`border-none shadow-lg hover:shadow-xl transition-shadow ${
                    rule.is_active === false ? "opacity-60" : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg capitalize">
                        {rule.service_type?.replace(/_/g, " ")}
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                        <p className="text-xs text-green-700 mb-1">Base Price</p>
                        <p className="text-2xl font-bold text-green-900">${base.toFixed(2)}</p>
                      </div>

                      {rule.damage_size && rule.damage_size !== "any" && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs text-blue-700 mb-1">Damage Size</p>
                          <p className="text-sm font-semibold text-blue-900 capitalize">
                            {rule.damage_size?.replace(/_/g, " ")}
                          </p>
                        </div>
                      )}
                    </div>

                    {(mobile > 0 || rush > 0) && (
                      <div className="space-y-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700">Surcharges:</p>
                        {mobile > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Mobile Service</span>
                            <span className="font-medium">+${mobile.toFixed(2)}</span>
                          </div>
                        )}
                        {rush > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Rush Service</span>
                            <span className="font-medium">+${rush.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {rule.description && (
                      <p className="text-sm text-gray-600 pt-2 border-t border-gray-200">{rule.description}</p>
                    )}

                    {rule.is_active === false && (
                      <div className="p-2 bg-red-50 rounded border border-red-200 text-center">
                        <p className="text-xs text-red-800 font-medium">Inactive</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

          {!isLoading && pricingRules.length === 0 && (
            <Card className="border-2 border-dashed border-gray-300">
              <CardContent className="py-16 text-center">
                <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Pricing Rules Yet</h3>
                <p className="text-gray-600 mb-6">Create your first pricing rule to get started</p>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pricing Rule
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}