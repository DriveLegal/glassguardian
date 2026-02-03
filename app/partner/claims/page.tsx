// app/partner/claims/page.tsx
"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Image as ImageIcon,
  FileText,
  DollarSign,
  TrendingUp,
  Eye,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// If you have a lightbox component in your project, point to it here.
// Otherwise, this can be removed or replaced later.
import ImageLightbox from "@/components/media/ImageLightbox";

type AnyObj = Record<string, any>;

type Partner = {
  id: string;
  company_name: string;
  portal_access_email: string;
};

type Claim = {
  id: string;
  claim_number: string;
  customer_email: string;
  insurance_carrier: string;
  policy_number: string;
  claim_amount?: number;
  approved_amount?: number | null;
  deductible_amount?: number | null;
  notes?: string | null;
  status:
    | "draft"
    | "submitted"
    | "pending_review"
    | "approved"
    | "denied"
    | "paid";
  submitted_date?: string | null;
  approval_date?: string | null;
  appointment_id?: string | null;
  claim_documents?: string[] | null; // array of file URLs (optional)
};

type Photo = {
  id: string;
  appointment_id: string;
  file_url: string;
  photo_type?: string | null;
};

function statusClass(s?: string) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    submitted: "bg-blue-100 text-blue-800",
    pending_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    denied: "bg-red-100 text-red-800",
    paid: "bg-emerald-100 text-emerald-800",
  };
  return map[s ?? ""] || "bg-gray-100 text-gray-800";
}

export default function InsurancePartnerPortalPage() {
  const queryClient = useQueryClient();

  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [partner, setPartner] = React.useState<Partner | null>(null);
  const [filter, setFilter] = React.useState<
    "pending_review" | "submitted" | "approved" | "denied" | "all"
  >("pending_review");

  const [selectedClaim, setSelectedClaim] = React.useState<Claim | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxPhotos, setLightboxPhotos] = React.useState<Photo[]>([]);
  const [decision, setDecision] = React.useState({
    approved_amount: 0,
    denial_reason: "",
    notes: "",
  });

  // Get current auth user
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

  // Load partner by portal_access_email
  const { isLoading: loadingPartner } = useQuery({
    queryKey: ["partner:me", userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("insurance_partners")
        .select("*")
        .eq("portal_access_email", userEmail)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setPartner((data as Partner) ?? null);
      return data as Partner | null;
    },
    staleTime: 10_000,
  });

  // Load all claims for this partner (carrier)
  const { data: allClaims = [], isLoading: loadingClaims } = useQuery({
    queryKey: ["partner:claims", partner?.company_name],
    enabled: !!partner?.company_name,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("insurance_claims")
        .select("*")
        .eq("insurance_carrier", partner!.company_name)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Claim[];
    },
  });

  // Approve claim
  const approveClaimMutation = useMutation({
    mutationFn: async ({
      claimId,
      approvedAmount,
    }: {
      claimId: string;
      approvedAmount: number;
    }) => {
      // Update claim
      const patch: AnyObj = {
        status: "approved",
        approved_amount: approvedAmount,
        approval_date: new Date().toISOString(),
        // You can store adjuster info if you track partner user meta
        // adjuster_name: ...,
        adjuster_email: userEmail ?? undefined,
      };

      const { error } = await supabaseClient
        .from("insurance_claims")
        .update(patch)
        .eq("id", claimId);
      if (error) throw error;

      // Optional: call an Edge Function / SMTP to notify customer
      // await supabaseClient.functions.invoke("notify-claim-approved", { body: { claimId, approvedAmount } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner:claims"] });
      setDialogOpen(false);
    },
  });

  // Deny / request more info
  const denyClaimMutation = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason: string }) => {
      const patch: AnyObj = {
        status: "denied",
        denial_reason: reason,
        // adjuster_name: ...,
        adjuster_email: userEmail ?? undefined,
      };
      const { error } = await supabaseClient
        .from("insurance_claims")
        .update(patch)
        .eq("id", claimId);
      if (error) throw error;

      // Optional: notify customer about request for more info
      // await supabaseClient.functions.invoke("notify-claim-denied", { body: { claimId, reason } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner:claims"] });
      setDialogOpen(false);
    },
  });

  async function handleViewClaim(claim: Claim) {
    setSelectedClaim(claim);
    setDecision({
      approved_amount: claim.claim_amount || 0,
      denial_reason: "",
      notes: claim.notes || "",
    });
    setDialogOpen(true);

    if (claim.appointment_id) {
      const { data, error } = await supabaseClient
        .from("photos")
        .select("*")
        .eq("appointment_id", claim.appointment_id);
      if (!error) setLightboxPhotos((data ?? []) as Photo[]);
    }
  }

  const filteredClaims =
    filter === "all" ? allClaims : allClaims.filter((c) => c.status === filter);

  const stats = React.useMemo(() => {
    const total = allClaims.length;
    const pending = allClaims.filter((c) =>
      ["submitted", "pending_review"].includes(c.status)
    ).length;
    const approved = allClaims.filter((c) => c.status === "approved").length;
    const denied = allClaims.filter((c) => c.status === "denied").length;
    const totalValue = allClaims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);
    const approvedValue = allClaims
      .filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + (c.approved_amount || 0), 0);
    return { total, pending, approved, denied, totalValue, approvedValue };
  }, [allClaims]);

  // Access control
  if (!loadingPartner && !partner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
        <Card className="max-w-md border-none shadow-2xl">
          <CardContent className="py-16 text-center">
            <Shield className="w-20 h-20 mx-auto mb-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h2>
            <p className="text-gray-600">
              You don&apos;t have access to the insurance partner portal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <Shield className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">
                {partner?.company_name} Portal
              </h1>
              <p className="text-blue-200 text-lg">Insurance Claims Management</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Dashboard */}
        <div className="grid md:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Total Claims", value: stats.total, icon: FileText, gradient: "from-blue-500 to-blue-600" },
            { label: "Pending Review", value: stats.pending, icon: Clock, gradient: "from-yellow-500 to-yellow-600" },
            { label: "Approved", value: stats.approved, icon: CheckCircle, gradient: "from-green-500 to-green-600" },
            { label: "Denied", value: stats.denied, icon: XCircle, gradient: "from-red-500 to-red-600" },
            { label: "Total Value", value: `$${stats.totalValue.toFixed(0)}`, icon: DollarSign, gradient: "from-purple-500 to-purple-600" },
            { label: "Approved Value", value: `$${stats.approvedValue.toFixed(0)}`, icon: TrendingUp, gradient: "from-emerald-500 to-emerald-600" },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <Card className={`border-none shadow-2xl bg-gradient-to-br ${stat.gradient} text-white hover:shadow-blue-500/30`}>
                <CardContent className="p-6 text-center">
                  <stat.icon className="w-8 h-8 mx-auto mb-3 opacity-90" />
                  <p className="text-3xl font-bold mb-1">{stat.value}</p>
                  <p className="text-xs opacity-90">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6 border-none shadow-2xl bg-white/95 backdrop-blur-sm">
          <CardContent className="p-6">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="grid grid-cols-5 w-full h-14">
                <TabsTrigger value="pending_review" className="text-base">
                  Pending ({stats.pending})
                </TabsTrigger>
                <TabsTrigger value="submitted" className="text-base">Submitted</TabsTrigger>
                <TabsTrigger value="approved" className="text-base">Approved</TabsTrigger>
                <TabsTrigger value="denied" className="text-base">Denied</TabsTrigger>
                <TabsTrigger value="all" className="text-base">All ({stats.total})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Claims List */}
        <div className="space-y-4">
          {filteredClaims.map((claim, idx) => (
            <motion.div
              key={claim.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="border-none shadow-2xl bg-white/95 backdrop-blur-sm hover:shadow-blue-500/30 transition-all">
                <CardContent className="p-8">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            Claim #{claim.claim_number}
                          </h3>
                          <Badge className={`${statusClass(claim.status)} text-base px-4 py-1`}>
                            {claim.status?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 mb-1">Submitted</p>
                          <p className="font-semibold text-gray-900">
                            {claim.submitted_date
                              ? format(new Date(claim.submitted_date), "MMM d, yyyy")
                              : "Not submitted"}
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6 mb-6">
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                          <p className="text-sm text-blue-700 font-medium mb-1">Policy Holder</p>
                          <p className="font-bold text-blue-900">{claim.customer_email}</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                          <p className="text-sm text-purple-700 font-medium mb-1">Policy Number</p>
                          <p className="font-bold text-purple-900">{claim.policy_number}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                          <p className="text-sm text-green-700 font-medium mb-1">Claim Amount</p>
                          <p className="text-3xl font-bold text-green-600">
                            ${Number(claim.claim_amount || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {claim.notes && (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Claim Details:</p>
                          <p className="text-gray-600">{claim.notes}</p>
                        </div>
                      )}

                      {claim.approved_amount && (
                        <div className="p-4 bg-green-50 rounded-xl border-2 border-green-300">
                          <p className="text-sm font-medium text-green-700 mb-1">Approved Amount</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${Number(claim.approved_amount).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3">
                      <Button
                        onClick={() => handleViewClaim(claim)}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-xl"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Review Claim
                      </Button>
                      {claim.claim_documents && claim.claim_documents.length > 0 && (
                        <Button variant="outline">
                          <Download className="w-4 h-4 mr-2" />
                          Download Docs
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {filteredClaims.length === 0 && !loadingClaims && (
            <Card className="border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm">
              <CardContent className="py-20 text-center">
                <Shield className="w-20 h-20 mx-auto mb-4 text-white/40" />
                <h3 className="text-2xl font-semibold text-white mb-3">No Claims Found</h3>
                <p className="text-white/70">No claims in this category</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Review Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-3xl">
                Review Claim #{selectedClaim?.claim_number}
              </DialogTitle>
            </DialogHeader>

            {selectedClaim && (
              <div className="space-y-6 mt-6">
                {/* Claim Summary */}
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Policy Holder</p>
                        <p className="font-bold text-gray-900">{selectedClaim.customer_email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Policy Number</p>
                        <p className="font-bold text-gray-900">{selectedClaim.policy_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Deductible</p>
                        <p className="font-bold text-gray-900">
                          ${Number(selectedClaim.deductible_amount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Photos */}
                {lightboxPhotos.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        Damage Documentation ({lightboxPhotos.length} photos)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                        {lightboxPhotos.map((photo) => (
                          <motion.div
                            key={photo.id}
                            whileHover={{ scale: 1.05 }}
                            onClick={() => {
                              setLightboxOpen(true);
                            }}
                            className="aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer shadow-lg"
                          >
                            <img
                              src={photo.file_url}
                              alt={photo.photo_type || "photo"}
                              className="w-full h-full object-cover"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Decision Form */}
                <Tabs defaultValue="approve">
                  <TabsList className="grid w-full grid-cols-2 h-14">
                    <TabsTrigger value="approve" className="text-lg">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Approve Claim
                    </TabsTrigger>
                    <TabsTrigger value="deny" className="text-lg">
                      <XCircle className="w-5 h-5 mr-2" />
                      Request More Info
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="approve" className="space-y-4 mt-6">
                    <div>
                      <Label className="text-lg">Approved Amount ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={decision.approved_amount}
                        onChange={(e) =>
                          setDecision({
                            ...decision,
                            approved_amount: parseFloat(e.target.value || "0"),
                          })
                        }
                        className="text-2xl h-16 font-bold text-green-600"
                      />
                      <p className="text-sm text-gray-600 mt-2">
                        Requested: ${Number(selectedClaim.claim_amount || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-lg">Adjuster Notes (Optional)</Label>
                      <Textarea
                        value={decision.notes}
                        onChange={(e) =>
                          setDecision({ ...decision, notes: e.target.value })
                        }
                        rows={3}
                        placeholder="Internal notes about this approval..."
                      />
                    </div>
                    <Button
                      onClick={() =>
                        approveClaimMutation.mutate({
                          claimId: selectedClaim.id,
                          approvedAmount: decision.approved_amount,
                        })
                      }
                      disabled={approveClaimMutation.isPending || !decision.approved_amount}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 py-6 text-xl font-bold shadow-2xl"
                    >
                      {approveClaimMutation.isPending
                        ? "Approving..."
                        : "Approve & Notify Customer"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="deny" className="space-y-4 mt-6">
                    <div>
                      <Label className="text-lg">Reason for Additional Review</Label>
                      <Textarea
                        value={decision.denial_reason}
                        onChange={(e) =>
                          setDecision({ ...decision, denial_reason: e.target.value })
                        }
                        rows={5}
                        placeholder="Please explain what additional information is needed..."
                        required
                      />
                    </div>
                    <Button
                      onClick={() =>
                        denyClaimMutation.mutate({
                          claimId: selectedClaim.id,
                          reason: decision.denial_reason,
                        })
                      }
                      disabled={denyClaimMutation.isPending || !decision.denial_reason}
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 py-6 text-xl font-bold shadow-2xl"
                    >
                      {denyClaimMutation.isPending ? "Sending..." : "Request Additional Information"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {lightboxOpen && lightboxPhotos.length > 0 && (
          <ImageLightbox
            images={lightboxPhotos}
            initialIndex={0}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    </div>
  );
}