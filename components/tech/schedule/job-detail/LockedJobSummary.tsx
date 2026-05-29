"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Lock,
  TriangleAlert,
  PenSquare,
  FileText,
  Eye,
} from "lucide-react";
import {
  WORKFLOW_STEPS,
  type RepairOutcome,
} from "@/components/tech/schedule/workflow/TechWorkflow";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function titleCaseUnderscore(value?: string | null) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

const cardIn = {
  initial: { opacity: 0, y: 10, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
};

export default function LockedJobSummary(props: {
  appointment: any;
  currentStep: number;
  effectiveVehicle: any;
  customerDisplayName: string;
  customerDisplayPhone: string;
  customerDisplayEmail: string;
  repairOutcome: RepairOutcome;
  crackOutCause: string;
  crackOutNotes: string;
  crackOutPhotoUrl: string | null;
  workNotes: string;
  resinUsed: string;
  cureTime: number;
  customerSignatureDataUrl: string | null;
  invoiceId: string | null;
  handleGoToInvoice: () => void;
  handleOpenUserSignature: () => void;
}) {
  const {
    appointment,
    currentStep,
    effectiveVehicle,
    customerDisplayName,
    customerDisplayPhone,
    customerDisplayEmail,
    repairOutcome,
    crackOutCause,
    crackOutNotes,
    crackOutPhotoUrl,
    workNotes,
    resinUsed,
    cureTime,
    customerSignatureDataUrl,
    invoiceId,
    handleGoToInvoice,
    handleOpenUserSignature,
  } = props;

  const isCrackOut =
    repairOutcome === "crack_out" || Boolean(appointment?.crack_out_occurred);

  return (
    <motion.div
      {...cardIn}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mb-6"
    >
      <Card className="overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-950 to-slate-950 text-slate-50 shadow-2xl">
        <div className="pointer-events-none h-1 w-full bg-gradient-to-r from-emerald-400 via-sky-400 to-blue-500 opacity-80" />

        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="h-5 w-5 text-emerald-300" />
                Job Completed • Locked Record
              </CardTitle>
              <p className="mt-2 text-sm text-slate-400">
                Final service details only.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="border border-emerald-300 bg-emerald-500/90 text-slate-950">
                <Lock className="mr-1 h-3.5 w-3.5" />
                LOCKED
              </Badge>

              {isCrackOut && (
                <Badge className="border border-amber-300 bg-amber-500/90 text-slate-950">
                  <TriangleAlert className="mr-1 h-3.5 w-3.5" />
                  CRACK-OUT
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Completion Summary
              </p>
              <div className="space-y-2 text-sm text-slate-200">
                <p>
                  <span className="text-slate-400">Service:</span>{" "}
                  {titleCaseUnderscore(appointment?.service_type) || "—"}
                </p>
                <p>
                  <span className="text-slate-400">Status:</span>{" "}
                  {titleCaseUnderscore(appointment?.status) || "Completed"}
                </p>
                <p>
                  <span className="text-slate-400">Completed at:</span>{" "}
                  {formatDateTime(appointment?.actual_end_time)}
                </p>
                <p>
                  <span className="text-slate-400">Workflow step:</span>{" "}
                  {currentStep + 1} / {WORKFLOW_STEPS.length}
                </p>
                <p>
                  <span className="text-slate-400">Outcome:</span>{" "}
                  {isCrackOut ? "Crack-out / replacement required" : "Completed"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Customer
              </p>
              <div className="space-y-2 text-sm text-slate-200">
                <p>
                  <span className="text-slate-400">Name:</span>{" "}
                  {customerDisplayName || "No name on file"}
                </p>
                <p>
                  <span className="text-slate-400">Phone:</span>{" "}
                  {customerDisplayPhone || "No phone on file"}
                </p>
                <p>
                  <span className="text-slate-400">Email:</span>{" "}
                  {customerDisplayEmail || "No email on file"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Vehicle
              </p>
              <div className="space-y-2 text-sm text-slate-200">
                <p>
                  <span className="text-slate-400">Vehicle:</span>{" "}
                  {effectiveVehicle
                    ? `${effectiveVehicle.year ?? ""} ${effectiveVehicle.make ?? ""} ${effectiveVehicle.model ?? ""}`.trim()
                    : "No vehicle attached"}
                </p>
                <p>
                  <span className="text-slate-400">Color:</span>{" "}
                  {effectiveVehicle?.color || "—"}
                </p>
                <p>
                  <span className="text-slate-400">Plate:</span>{" "}
                  {effectiveVehicle?.license_plate || "—"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tech Notes
              </p>
              <div className="space-y-2 text-sm text-slate-200">
                <p>
                  <span className="text-slate-400">Resin:</span>{" "}
                  {resinUsed || "—"}
                </p>
                <p>
                  <span className="text-slate-400">Cure time:</span>{" "}
                  {cureTime ? `${cureTime} min` : "—"}
                </p>
                <p className="leading-relaxed">
                  <span className="text-slate-400">Work notes:</span>{" "}
                  {workNotes || "—"}
                </p>
              </div>
            </div>
          </div>

          {appointment?.service_address && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <span className="text-slate-400">Service address:</span>{" "}
              {appointment.service_address}
            </div>
          )}

          {appointment?.damage_description && (
            <div className="rounded-2xl border border-sky-700/40 bg-slate-900/70 p-4 text-sm text-slate-200">
              <span className="text-slate-400">Damage:</span>{" "}
              {appointment.damage_description}
            </div>
          )}

          {appointment?.notes_customer && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <span className="text-slate-400">Customer notes:</span>{" "}
              {appointment.notes_customer}
            </div>
          )}

          {isCrackOut && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                Crack-out Details
              </p>
              <div className="space-y-2 text-sm text-slate-200">
                <p>
                  <span className="text-slate-400">Cause:</span>{" "}
                  {crackOutCause || "—"}
                </p>
                <p className="leading-relaxed">
                  <span className="text-slate-400">Notes:</span>{" "}
                  {crackOutNotes || "—"}
                </p>
              </div>

              {crackOutPhotoUrl && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-slate-400">Crack-out photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={crackOutPhotoUrl}
                    alt="Crack-out"
                    className="h-44 w-full rounded-xl border border-slate-800 object-cover"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {invoiceId && (
              <>
                <Button
                  onClick={handleGoToInvoice}
                  className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                >
                  <PenSquare className="mr-2 h-4 w-4" />
                  Edit Invoice
                </Button>

                <Button
                  variant="outline"
                  onClick={handleGoToInvoice}
                  className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Invoice
                </Button>
              </>
            )}

            <Button
              variant="outline"
              onClick={handleOpenUserSignature}
              disabled={!customerSignatureDataUrl}
              className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Eye className="mr-2 h-4 w-4" />
              View User Signature
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}