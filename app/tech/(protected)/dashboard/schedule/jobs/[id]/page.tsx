"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import WaiverGate from "@/components/tech/schedule/waiver/WaiverGate";
import TenStepProgress, {
  ServiceStatusKey,
} from "@/components/tech/schedule/tenstep/ServiceProgress";
import TechWorkflow from "@/components/tech/schedule/workflow/TechWorkflow";
import LockedJobSummary from "@/components/tech/schedule/job-detail/LockedJobSummary";
import { useTechJobDetailPage } from "@/components/tech/schedule/job-detail/useTechJobDetailPage";

import { AlertCircle, ArrowLeft, TriangleAlert, X } from "lucide-react";

const cardIn = {
  initial: { opacity: 0, y: 10, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
};

export default function TechJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? "";

  const vm = useTechJobDetailPage(jobId);

  if (vm.isLoading || vm.loadingWaiver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="relative h-12 w-12 animate-spin rounded-full border-b-2 border-sky-300" />
        </div>
      </div>
    );
  }

  if (vm.appointmentError) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <Card className="max-w-md border border-slate-700/80 bg-slate-950/95 text-slate-50">
          <CardContent className="py-8 text-center space-y-3">
            <h2 className="text-lg font-semibold text-slate-50">Error loading job</h2>
            <p className="text-sm text-slate-400">
              There was a problem loading this appointment. Check Supabase RLS /
              permissions for the technician.
            </p>
            <Button
              onClick={vm.goBack}
              className="bg-sky-500 hover:bg-sky-600 text-slate-950"
            >
              Back to Job Board
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!vm.appointment) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <Card className="max-w-md border border-slate-700/80 bg-slate-950/95 text-slate-50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h2 className="mb-2 text-xl font-bold text-slate-50">Job Not Found</h2>
            <Button
              onClick={vm.goBack}
              className="bg-sky-500 hover:bg-sky-600 text-slate-950"
            >
              Back to Job Board
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <WaiverGate
        key={`waiver:${jobId}`}
        appointment={vm.appointment}
        open={vm.waiverOpen}
        onOpenChangeAction={vm.setWaiverOpen}
        onSatisfiedAction={vm.onWaiverSatisfied}
      />

      <AnimatePresence>
        {vm.toast && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="fixed top-4 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="rounded-full border border-slate-700 bg-slate-950/90 px-4 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur">
              {vm.toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {vm.signaturePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm"
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {vm.signaturePreview.title}
                    </p>
                    <p className="text-xs text-slate-400">Waiver record preview</p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => vm.setSignaturePreview(null)}
                    className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                </div>

                <div className="bg-slate-900/40 p-4">
                  <div className="rounded-2xl border border-slate-800 bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={vm.signaturePreview.url}
                      alt={vm.signaturePreview.title}
                      className="max-h-[70vh] w-full rounded-xl object-contain"
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-4xl text-slate-50">
          {!vm.appointment?.technician_email && (
            <div className="mb-5 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 text-sky-200" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-sky-100">
                    This job is currently unassigned.
                  </p>
                  <p className="text-xs text-slate-300">
                    We’ll attempt to auto-claim it for your tech email so status updates
                    work with RLS. If it fails, your RLS claim policy is missing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!!vm.appointment?.technician_email && !vm.isAssignedToMe && (
            <div className="mb-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-300" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-100">
                    Assigned to another technician.
                  </p>
                  <p className="text-xs text-slate-300">
                    You may be able to view this job, but RLS can block updates unless
                    the appointment&apos;s technician_email matches your auth email.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={vm.goBack}
              className="border-slate-600 bg-slate-900/70 text-slate-50 transition-all hover:bg-slate-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Board
            </Button>

            {vm.headerActions}
          </div>

          {vm.jobLocked ? (
            <LockedJobSummary
            appointment={vm.appointment}
            currentStep={vm.currentStep}
            effectiveVehicle={vm.effectiveVehicle}
            customerDisplayName={vm.customerDisplayName}
            customerDisplayPhone={vm.customerDisplayPhone}
            customerDisplayEmail={vm.customerDisplayEmail}
            repairOutcome={vm.repairOutcome}
            crackOutCause={vm.crackOutCause}
            crackOutNotes={vm.crackOutNotes}
            crackOutPhotoUrl={vm.crackOutPhotoUrl}
            workNotes={vm.workNotes}
            resinUsed={vm.resinUsed}
            cureTime={vm.cureTime}
            customerSignatureDataUrl={vm.customerSignatureDataUrl}
            invoiceId={vm.invoiceId}
            handleGoToInvoice={vm.handleGoToInvoice}
            handleOpenUserSignature={vm.handleOpenUserSignature}
            />
          ) : (
            <div>
              {!vm.waiverSatisfied && (
                <div className="mb-5 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-300" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-100">
                        Waiver must be satisfied before repair begins.
                      </p>
                      <p className="text-xs text-slate-300">
                        You can still mark Arrived on Site, but you cannot proceed to
                        inspection or repair steps until the customer signs on device or
                        you mark sign in portal.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {vm.infoCard}

              <motion.div
                {...cardIn}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.04 }}
              >
                <TenStepProgress
                  key={`${String(vm.appointment?.status ?? "none")}:${String(
                    vm.appointment?.tech_workflow_step ?? "none"
                  )}:${String(vm.updateStatusPending)}:${String(
                    vm.waiverSatisfied
                  )}:${String(vm.jobLocked)}`}
                  status={vm.appointment?.status}
                  busy={vm.updateStatusPending || vm.completing}
                  onStatusClickAction={(k) =>
                    vm.handleStatusClick(k as ServiceStatusKey)
                  }
                  isStatusLockedAction={(next) => {
                    const locked: ServiceStatusKey[] = [
                      "in_progress",
                      "curing",
                      "completed",
                    ];
                    return !vm.waiverSatisfied && locked.includes(next as ServiceStatusKey);
                  }}
                />
              </motion.div>

              <TechWorkflow
                currentStep={vm.currentStep}
                workflowLocked={vm.workflowLocked}
                waiverSatisfied={vm.waiverSatisfied}
                openWaiverAction={vm.openWaiverAction}
                setAndPersistStepAction={vm.setAndPersistStep}
                handleNextStepAction={vm.handleNextStep}
                isBusy={vm.busy}
                isUploading={vm.uploading}
                photos={vm.photos}
                handlePhotoUploadAction={vm.handlePhotoUpload}
                removePhotoAction={vm.removePhoto}
                resinUsed={vm.resinUsed}
                setResinUsedAction={vm.setResinUsed}
                workNotes={vm.workNotes}
                setWorkNotesAction={vm.setWorkNotes}
                cureTime={vm.cureTime}
                setCureTimeAction={vm.setCureTime}
                repairOutcome={vm.repairOutcome}
                setRepairOutcomeAction={vm.setRepairOutcome}
                crackOutCause={vm.crackOutCause}
                setCrackOutCauseAction={vm.setCrackOutCause}
                crackOutNotes={vm.crackOutNotes}
                setCrackOutNotesAction={vm.setCrackOutNotes}
                crackOutPhotoUrl={vm.crackOutPhotoUrl}
                crackOutUploading={vm.crackOutUploading}
                handleCrackOutUploadAction={vm.handleCrackOutUpload}
                canComplete={vm.canComplete}
                completeJobAction={vm.handleComplete}
                completing={vm.completing}
              />
            </div>
          )}

          <div className="pb-10 text-center text-[11px] text-slate-500">
            Job ID:{" "}
            <span className="text-slate-400">{String(jobId).slice(0, 12)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}