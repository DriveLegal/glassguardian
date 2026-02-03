// app/user/(protected)/claims/page.tsx
"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  FileText,
  Plus,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  Shield,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ---- Types (loose) ----
type AnyObj = Record<string, any>;
type Claim = {
  id: string;
  customer_email: string;
  claim_number: string;
  status:
    | "draft"
    | "submitted"
    | "pending_review"
    | "approved"
    | "denied"
    | "paid";
  insurance_carrier: string;
  policy_number: string;
  claim_amount?: number;
  approved_amount?: number;
  deductible_amount?: number;
  notes?: string;
  submitted_date?: string | null;
  claim_documents?: string[] | null;
  created_at?: string;
};
type Appointment = {
  id: string;
  customer_email: string;
  service_type?: string | null;
  scheduled_date?: string | null;
};
type Vehicle = {
  id: string;
  owner_email: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
};

// ---- Helpers ----
function getStatusColor(status?: string) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    submitted: "bg-blue-100 text-blue-800",
    pending_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
    paid: "bg-emerald-100 text-emerald-800",
  };
  return map[status ?? ""] || "bg-gray-100 text-gray-800";
}
function StatusIcon({ status }: { status?: string }) {
  if (status === "approved" || status === "paid") {
    return <CheckCircle className="w-4 h-4" />;
  }
  if (status === "denied") {
    return <XCircle className="w-4 h-4" />;
  }
  return <Clock className="w-4 h-4" />;
}

export default function InsuranceClaimsPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [uploadedDocs, setUploadedDocs] = React.useState<string[]>([]);
  const [formData, setFormData] = React.useState({
    appointment_id: "",
    vehicle_id: "",
    insurance_carrier: "",
    policy_number: "",
    claim_amount: 0,
    deductible_amount: 0,
    notes: "",
  });

  // ---- Auth (pull current user) ----
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const email = data?.session?.user?.email ?? null;
      if (!mounted) return;
      setUserEmail(email);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- Queries ----
  const { data: claims = [] } = useQuery({
    queryKey: ["my-insurance-claims", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("insurance_claims")
        .select("*")
        .eq("customer_email", userEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Claim[];
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["my-appointments", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("customer_email", userEmail)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["my-vehicles", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select("*")
        .eq("owner_email", userEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Vehicle[];
    },
  });

  // ---- Upload to Supabase Storage (bucket: claim-docs) ----
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userEmail) return;

    const filePath = `${userEmail}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabaseClient.storage
      .from("claim-docs")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });
    if (upErr) {
      console.error("Upload failed:", upErr.message);
      return;
    }
    const { data: urlData } = supabaseClient.storage
      .from("claim-docs")
      .getPublicUrl(filePath);
    if (urlData?.publicUrl) {
      setUploadedDocs((prev) => [...prev, urlData.publicUrl]);
    }
  }

  // ---- Create Claim ----
  const createClaimMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      if (!userEmail) throw new Error("No user");

      const { data, error } = await supabaseClient
        .from("insurance_claims")
        .insert([
          {
            customer_email: userEmail,
            claim_number: `CLM-${Date.now()}`,
            status: "draft",
            appointment_id: payload.appointment_id || null,
            vehicle_id: payload.vehicle_id || null,
            insurance_carrier: payload.insurance_carrier,
            policy_number: payload.policy_number,
            claim_amount: payload.claim_amount || 0,
            deductible_amount: payload.deductible_amount || 0,
            notes: payload.notes || null,
            claim_documents: uploadedDocs,
          },
        ])
        .select("*")
        .single();

      if (error) throw error;

      // Optional: fire-and-forget notification insert (replace with your actual notifications setup)
      await supabaseClient.from("notifications").insert([
        {
          recipient_email: userEmail,
          type: "insurance_claim_filed",
          payload: {
            claimNumber: data.claim_number,
            carrier: data.insurance_carrier,
          },
        },
      ]);

      return data as Claim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-insurance-claims", userEmail] });
      setDialogOpen(false);
      setFormData({
        appointment_id: "",
        vehicle_id: "",
        insurance_carrier: "",
        policy_number: "",
        claim_amount: 0,
        deductible_amount: 0,
        notes: "",
      });
      setUploadedDocs([]);
    },
  });

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header + New Claim */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-10 h-10 text-blue-600" />
              Insurance Claims
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              File and track your insurance claims
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl">
                <Plus className="w-4 h-4 mr-2" />
                New Claim
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">File Insurance Claim</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-6">
                {/* Appointment */}
                <div>
                  <Label>Related Appointment</Label>
                  <select
                    value={formData.appointment_id}
                    onChange={(e) =>
                      setFormData({ ...formData, appointment_id: e.target.value })
                    }
                    className="w-full mt-2 p-3 border rounded-lg"
                  >
                    <option value="">Select appointment...</option>
                    {appointments.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.service_type?.replace(/_/g, " ")} — {apt.scheduled_date}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vehicle */}
                <div>
                  <Label>Vehicle</Label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) =>
                      setFormData({ ...formData, vehicle_id: e.target.value })
                    }
                    className="w-full mt-2 p-3 border rounded-lg"
                  >
                    <option value="">Select vehicle...</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Core fields */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Insurance Carrier *</Label>
                    <Input
                      value={formData.insurance_carrier}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          insurance_carrier: e.target.value,
                        })
                      }
                      placeholder="State Farm"
                    />
                  </div>
                  <div>
                    <Label>Policy Number *</Label>
                    <Input
                      value={formData.policy_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          policy_number: e.target.value,
                        })
                      }
                      placeholder="POL-123456"
                    />
                  </div>
                  <div>
                    <Label>Claim Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.claim_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          claim_amount: parseFloat(e.target.value || "0"),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Deductible ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.deductible_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deductible_amount: parseFloat(e.target.value || "0"),
                        })
                      }
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                    placeholder="Additional claim details..."
                  />
                </div>

                {/* Uploads */}
                <div>
                  <Label>Upload Documents</Label>
                  <div className="mt-2 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-all">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="claim-docs"
                    />
                    <label htmlFor="claim-docs" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Upload insurance documents, photos, estimates
                      </p>
                    </label>
                  </div>
                  {uploadedDocs.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadedDocs.map((doc, idx) => (
                        <div
                          key={doc}
                          className="flex items-center gap-2 text-sm text-gray-600"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Document {idx + 1} uploaded
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <Button
                  onClick={() => createClaimMutation.mutate(formData)}
                  disabled={
                    !formData.insurance_carrier ||
                    !formData.policy_number ||
                    createClaimMutation.isPending
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
                >
                  {createClaimMutation.isPending
                    ? "Creating Claim..."
                    : "Create Claim"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {[
            {
              label: "Total Claims",
              value: claims.length,
              gradient: "from-blue-500 to-blue-600",
            },
            {
              label: "Approved",
              value: claims.filter((c) => c.status === "approved").length,
              gradient: "from-green-500 to-green-600",
            },
            {
              label: "Pending",
              value: claims.filter((c) =>
                ["submitted", "pending_review"].includes(c.status)
              ).length,
              gradient: "from-yellow-500 to-yellow-600",
            },
            {
              label: "Total Value",
              value: `$${claims
                .reduce((sum, c) => sum + (c.claim_amount || 0), 0)
                .toFixed(2)}`,
              gradient: "from-purple-500 to-purple-600",
            },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <Card
                className={`border-none shadow-xl bg-gradient-to-br ${stat.gradient} text-white`}
              >
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold mb-2">{stat.value}</p>
                  <p className="text-sm opacity-90">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Claims List */}
        <div className="space-y-4">
          {claims.map((claim, idx) => (
            <motion.div
              key={claim.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="border-none shadow-xl hover:shadow-2xl transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            Claim #{claim.claim_number}
                          </h3>
                          <span
                            className={`${getStatusColor(
                              claim.status
                            )} inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium`}
                          >
                            <StatusIcon status={claim.status} />
                            {claim.status?.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Insurance Carrier</p>
                          <p className="font-semibold text-gray-900">
                            {claim.insurance_carrier}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Policy Number</p>
                          <p className="font-semibold text-gray-900">
                            {claim.policy_number}
                          </p>
                        </div>
                        {claim.submitted_date && (
                          <div>
                            <p className="text-sm text-gray-600">Submitted</p>
                            <p className="font-semibold text-gray-900">
                              {format(
                                new Date(claim.submitted_date),
                                "MMM d, yyyy"
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {claim.notes && (
                        <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg border">
                          {claim.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col justify-between items-end gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-600 mb-1">Claim Amount</p>
                        <p className="text-3xl font-bold text-gray-900">
                          ${Number(claim.claim_amount || 0).toFixed(2)}
                        </p>
                        {typeof claim.approved_amount === "number" && (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            Approved: ${Number(claim.approved_amount).toFixed(2)}
                          </p>
                        )}
                      </div>

                      {/* Stub: download claim packet */}
                      <Button variant="outline" size="sm">
                        <Download className="w-3 h-3 mr-1" />
                        Download Packet
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {claims.length === 0 && (
            <Card className="border-2 border-dashed border-gray-300">
              <CardContent className="py-20 text-center">
                <FileText className="w-20 h-20 mx-auto mb-4 text-gray-400" />
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  No Insurance Claims
                </h3>
                <p className="text-gray-600 mb-6">
                  File your first insurance claim to get reimbursed
                </p>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  File a Claim
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}