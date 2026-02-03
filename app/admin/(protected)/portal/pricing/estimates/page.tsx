"use client";

import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabaseClient } from "@/lib/supabaseClient";
import { notifyEstimateReady } from "@/lib/notify";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  FileText,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Send,
} from "lucide-react";

type AnyObj = Record<string, any>;

const statusClass = (status: string) => {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    pending_review: "bg-yellow-100 text-yellow-800",
    sent: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    expired: "bg-gray-100 text-gray-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
};

export default function AdminEstimatesPage() {
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "sent" | "approved" | "rejected">(
    "all"
  );
  const [selectedAppointment, setSelectedAppointment] = useState<AnyObj | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    estimated_amount: 0, // derived, recalculated before submit
    labor_cost: 0,
    parts_cost: 0,
    additional_fees: 0,
    damage_assessment: "",
    notes_admin: "",
  });

  /* ----------------------------- Queries ----------------------------- */

  // Appointments needing estimates (status = 'estimating')
  const { data: appointments = [] } = useQuery({
    queryKey: ["estimates:appointments-estimating"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("status", "estimating")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 10_000,
  });

  // Estimates history
  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates:all"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("estimates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 10_000,
  });

  // Recent photos (limit 100)
  const { data: photos = [] } = useQuery({
    queryKey: ["estimates:photos:recent"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("photos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as AnyObj[];
    },
    staleTime: 10_000,
  });

  const appointmentPhotos = selectedAppointment
    ? photos.filter((p: AnyObj) => p.appointment_id === selectedAppointment.id)
    : [];

  /* ---------------------------- Mutations ---------------------------- */

  // Create estimate (draft)
  const createEstimate = useMutation({
    mutationFn: async (payload: AnyObj) => {
      const { data, error } = await supabaseClient.from("estimates").insert(payload).select().single();
      if (error) throw error;
      return data as AnyObj;
    },
  });

  // Send estimate (flip to sent, stamp dates; update appointment and notify)
  const sendEstimate = useMutation({
    mutationFn: async ({
      estimateId,
      appointmentId,
      customerEmail,
      amount,
    }: {
      estimateId: string;
      appointmentId: string;
      customerEmail: string;
      amount: number;
    }) => {
      const sentAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1) estimates → sent
      {
        const { error } = await supabaseClient
          .from("estimates")
          .update({ status: "sent", sent_date: sentAt, expires_date: expiresAt })
          .eq("id", estimateId);
        if (error) throw error;
      }

      // 2) appointments → estimate_sent + amount
      {
        const { error } = await supabaseClient
          .from("appointments")
          .update({ status: "estimate_sent", estimate_amount: amount })
          .eq("id", appointmentId);
        if (error) throw error;
      }

      // 3) notify via Supabase Function / external mailer
      await notifyEstimateReady({
        recipientEmail: customerEmail,
        appointmentId,
        amount,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimates:appointments-estimating"] });
      qc.invalidateQueries({ queryKey: ["estimates:all"] });
      setDialogOpen(false);
      setSelectedAppointment(null);
    },
    onError: () => {
      setDialogOpen(false);
      setSelectedAppointment(null);
    },
  });

  // (Optional) update estimate status (approve/reject, not wired in UI here)
  const updateEstimateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabaseClient
        .from("estimates")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimates:all"] });
    },
  });

  /* --------------------------- UI Handlers --------------------------- */

  const handleReviewAppointment = (appointment: AnyObj) => {
    setSelectedAppointment(appointment);
    setFormData({
      estimated_amount: appointment.estimate_amount || 0, // initial, will be recalculated
      labor_cost: 0,
      parts_cost: 0,
      additional_fees: 0,
      damage_assessment: appointment.damage_description || "",
      notes_admin: "",
    });
    setDialogOpen(true);
  };

  const handleSubmitEstimate = async () => {
    if (!selectedAppointment) return;

    const total =
      (Number(formData.labor_cost) || 0) +
      (Number(formData.parts_cost) || 0) +
      (Number(formData.additional_fees) || 0);

    // 1) Create estimate as draft
    const draftPayload: AnyObj = {
      appointment_id: selectedAppointment.id,
      customer_email: selectedAppointment.customer_email,
      service_type: selectedAppointment.service_type,
      estimated_amount: total,
      labor_cost: Number(formData.labor_cost) || 0,
      parts_cost: Number(formData.parts_cost) || 0,
      additional_fees: Number(formData.additional_fees) || 0,
      damage_assessment: formData.damage_assessment,
      notes_admin: formData.notes_admin,
      status: "draft",
    };

    try {
      const newEstimate = await createEstimate.mutateAsync(draftPayload);
      // 2) Immediately "send" (flip + dates + appointment update + notify)
      await sendEstimate.mutateAsync({
        estimateId: newEstimate.id,
        appointmentId: selectedAppointment.id,
        customerEmail: selectedAppointment.customer_email,
        amount: total,
      });
    } catch {
      // handled in onError of sendEstimate or by throw
    }
  };

  const isSubmitting = createEstimate.isPending || sendEstimate.isPending;

  /* ------------------------------ Render ----------------------------- */

  const filteredEstimates =
    filter === "all" ? estimates : estimates.filter((e: AnyObj) => e.status === filter);

  const unreadCount = appointments.length; // “Pending review” count

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Estimate Review Queue
          </h1>
          <p className="text-gray-600 mt-1">Review photos and create estimates</p>
        </div>

        {/* KPI */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Pending Review</p>
              <p className="text-3xl font-bold">{appointments.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Sent</p>
              <p className="text-3xl font-bold">
                {estimates.filter((e: AnyObj) => e.status === "sent").length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Approved</p>
              <p className="text-3xl font-bold">
                {estimates.filter((e: AnyObj) => e.status === "approved").length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Rejected</p>
              <p className="text-3xl font-bold">
                {estimates.filter((e: AnyObj) => e.status === "rejected").length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Awaiting Review */}
        {appointments.length > 0 && (
          <Card className="mb-8 border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Awaiting Review ({appointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {appointments.map((apt: AnyObj) => (
                  <div
                    key={apt.id}
                    className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {apt.service_type?.replace(/_/g, " ").toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-600">{apt.customer_email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted{" "}
                        {apt.created_at
                          ? format(new Date(apt.created_at), "MMM d, h:mm a")
                          : "—"}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleReviewAppointment(apt)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Review Photos
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Estimate History</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="mb-6">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-3">
              {filteredEstimates.map((estimate: AnyObj) => (
                <div
                  key={estimate.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {estimate.service_type?.replace(/_/g, " ").toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-600">{estimate.customer_email}</p>
                      <Badge className={`mt-2 ${statusClass(estimate.status)}`}>
                        {estimate.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        $
                        {typeof estimate.estimated_amount === "number"
                          ? estimate.estimated_amount.toFixed(2)
                          : "0.00"}
                      </p>
                      {estimate.sent_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Sent {format(new Date(estimate.sent_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredEstimates.length === 0 && (
                <p className="text-center text-gray-500 py-12">No estimates found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog: Review & Create */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review & Create Estimate</DialogTitle>
            </DialogHeader>

            {selectedAppointment && (
              <div className="space-y-6 mt-4">
                {/* Photos */}
                <div>
                  <Label className="text-lg font-semibold mb-3 block">Damage Photos</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {appointmentPhotos.map((photo: AnyObj) => (
                      <a
                        key={photo.id}
                        href={photo.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.file_url}
                          alt={photo.photo_type}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-end p-2">
                          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100">
                            {photo.photo_type?.replace(/_/g, " ")}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                  {appointmentPhotos.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No photos uploaded yet</p>
                  )}
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div>
                    <Label>Damage Assessment</Label>
                    <Textarea
                      value={formData.damage_assessment}
                      onChange={(e) =>
                        setFormData({ ...formData, damage_assessment: e.target.value })
                      }
                      rows={3}
                      placeholder="Describe the damage and repair approach..."
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Labor Cost ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.labor_cost}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            labor_cost: parseFloat(e.target.value || "0"),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Parts Cost ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.parts_cost}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            parts_cost: parseFloat(e.target.value || "0"),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Additional Fees ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.additional_fees}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            additional_fees: parseFloat(e.target.value || "0"),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Total Estimate:</span>
                      <span className="text-3xl font-bold text-green-600">
                        {Number.isFinite(
                          (formData.labor_cost || 0) +
                            (formData.parts_cost || 0) +
                            (formData.additional_fees || 0)
                        )
                          ? `$${(
                              (formData.labor_cost || 0) +
                              (formData.parts_cost || 0) +
                              (formData.additional_fees || 0)
                            ).toFixed(2)}`
                          : "$0.00"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label>Internal Notes</Label>
                    <Textarea
                      value={formData.notes_admin}
                      onChange={(e) =>
                        setFormData({ ...formData, notes_admin: e.target.value })
                      }
                      rows={2}
                      placeholder="Notes for internal use only..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitEstimate}
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {isSubmitting ? "Sending..." : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Estimate to Customer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}