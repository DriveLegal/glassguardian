"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import SignatureCanvas from "@/components/forms/SignatureCanvas";

import {
  Camera,
  CheckCircle,
  Clock,
  MapPin,
  AlertCircle,
  FileText,
  TriangleAlert,
  ShieldCheck,
  Loader2,
  X,
} from "lucide-react";

/* ----------------------------------------------
   Shared helpers/types (moved from page)
-----------------------------------------------*/

export const WORKFLOW_STEPS = [
  { id: "arrive", label: "Arrive on Site", status: "on_site", icon: MapPin },
  { id: "inspect", label: "Inspect Damage", status: "in_progress", icon: AlertCircle },
  { id: "repair", label: "Perform Repair", status: "in_progress", icon: CheckCircle },
  { id: "cure", label: "Curing Process", status: "curing", icon: Clock },
  { id: "photos", label: "Final Photos", status: "curing", icon: Camera },
  { id: "complete", label: "Complete & Sign", status: "completed", icon: FileText },
] as const;

export type RepairOutcome = "completed" | "crack_out";

export const CRACK_OUT_CAUSES = [
  { value: "pre_existing_stress", label: "Pre-existing stress / pressure" },
  { value: "damage_too_deep", label: "Damage too deep" },
  { value: "edge_crack", label: "Edge crack / near edge" },
  { value: "temperature_stress", label: "Temperature stress" },
  { value: "unknown", label: "Unknown" },
] as const;

export type PhotosByStage = {
  before: string[];
  during: string[];
  after: string[];
};

export function clampWorkflowStep(n: number) {
  return Math.max(0, Math.min(WORKFLOW_STEPS.length - 1, n));
}

export function statusToWorkflowStep(status?: string | null): number {
  if (!status) return 0;
  const idx = WORKFLOW_STEPS.findIndex((s) => s.status === status);
  if (idx === -1) return 0;
  return Math.min(idx, WORKFLOW_STEPS.length - 1);
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const cardIn = {
  initial: { opacity: 0, y: 10, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
};

/* ----------------------------------------------
   Component Props
-----------------------------------------------*/

export default function TechWorkflow(props: {
  currentStep: number;
  workflowLocked: boolean;

  // waiver
  waiverSatisfied: boolean;
  openWaiverAction: () => void;

  // step navigation
  setAndPersistStepAction: (nextStep: number) => void;
  handleNextStepAction: () => void;

  // loading flags
  isBusy: boolean;
  isUploading: boolean;

  // photos
  photos: PhotosByStage;
  handlePhotoUploadAction: (
    e: React.ChangeEvent<HTMLInputElement>,
    photoType: string,
    stage: keyof PhotosByStage
  ) => void;

  // ✅ allow removing a photo (NOW SAFE)
  removePhotoAction?: (stage: keyof PhotosByStage, url: string) => void;

  // notes / repair params
  resinUsed: string;
  setResinUsedAction: (v: string) => void;

  workNotes: string;
  setWorkNotesAction: (v: string) => void;

  cureTime: number;
  setCureTimeAction: (v: number) => void;

  // completion & crack-out
  repairOutcome: RepairOutcome;
  setRepairOutcomeAction: (v: RepairOutcome) => void;

  crackOutCause: (typeof CRACK_OUT_CAUSES)[number]["value"] | "";
  setCrackOutCauseAction: (v: (typeof CRACK_OUT_CAUSES)[number]["value"] | "") => void;

  crackOutNotes: string;
  setCrackOutNotesAction: (v: string) => void;

  crackOutPhotoUrl: string | null;
  crackOutUploading: boolean;
  handleCrackOutUploadAction: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // signature + completion
  techSignatureDataUrl: string | null;
  setTechSignatureDataUrlAction: (v: string | null) => void;

  canComplete: boolean;
  completeJobAction: () => void;
  completing: boolean;
}) {
  const {
    currentStep,
    workflowLocked,
    waiverSatisfied,
    openWaiverAction,
    setAndPersistStepAction,
    handleNextStepAction,
    isBusy,
    isUploading,
    photos,
    handlePhotoUploadAction,
    removePhotoAction,
    resinUsed,
    setResinUsedAction,
    workNotes,
    setWorkNotesAction,
    cureTime,
    setCureTimeAction,
    repairOutcome,
    setRepairOutcomeAction,
    crackOutCause,
    setCrackOutCauseAction,
    crackOutNotes,
    setCrackOutNotesAction,
    crackOutPhotoUrl,
    crackOutUploading,
    handleCrackOutUploadAction,
    techSignatureDataUrl,
    setTechSignatureDataUrlAction,
    canComplete,
    completeJobAction,
    completing,
  } = props;

  const isCrackOut = repairOutcome === "crack_out";

  // ✅ SAFE WRAPPER: prevents runtime crash if prop wasn't passed
  const safeRemovePhoto = React.useCallback(
    (stage: keyof PhotosByStage, url: string) => {
      if (typeof removePhotoAction === "function") removePhotoAction(stage, url);
    },
    [removePhotoAction]
  );

  return (
    <motion.div {...cardIn} transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}>
      <Card className="mb-6 border border-slate-700/80 bg-slate-950/95 shadow-2xl text-slate-50">
        <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/80">
          <CardTitle className="text-2xl flex items-center gap-3 text-slate-50">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-sky-400/20 blur-md animate-pulse" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center shadow-[0_0_18px_rgba(56,189,248,0.8)]">
                <span className="text-white font-bold text-xl">{currentStep + 1}</span>
              </div>
            </div>
            {WORKFLOW_STEPS[currentStep]?.label ?? "Workflow"}
            {isBusy && (
              <Badge className="ml-auto bg-slate-800 text-slate-200 border border-slate-600">
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Syncing
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 p-6 md:p-8 text-slate-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={`step-${currentStep}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="space-y-4"
            >
              {/* WAIVER LOCK PANEL */}
              {workflowLocked && (
                <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="w-5 h-5 text-amber-300 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-amber-100">
                        Workflow locked — waiver required.
                      </p>
                      <p className="text-xs text-slate-300">
                        The customer must sign the waiver (device) or you can mark “sign in portal”.
                      </p>
                      <Button
                        onClick={openWaiverAction}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                      >
                        Open Waiver Options
                        <ShieldCheck className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 0: Arrive */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-sky-700/70 bg-slate-900/80 px-4 py-3 text-slate-100">
                    <div className="text-sm">
                      <strong>Before you begin:</strong>
                      <ul className="list-disc ml-5 mt-2 space-y-1">
                        <li>Verify customer identity</li>
                        <li>Inspect vehicle for additional damage</li>
                        <li>Confirm service location is safe</li>
                        <li>Review customer special notes</li>
                      </ul>
                    </div>
                  </div>

                  <Button
                    onClick={handleNextStepAction}
                    className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all"
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Marking...
                      </>
                    ) : (
                      <>
                        Mark as Arrived
                        <CheckCircle className="ml-2 w-5 h-5" />
                      </>
                    )}
                  </Button>

                  {!waiverSatisfied ? (
                    <Button
                      onClick={() => setAndPersistStepAction(1)}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                    >
                      Continue (Waiver Required)
                      <ShieldCheck className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setAndPersistStepAction(1)}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold"
                    >
                      Continue to Inspect
                      <CheckCircle className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}

              {/* Step 1: Inspect */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-100">Close up before repair</Label>
                    <div className="grid grid-cols-1 gap-4 mt-2">
                      <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center bg-slate-900/70 hover:bg-slate-900/90 transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUploadAction(e, "before_repair_closeup", "before")}
                          className="hidden"
                          id="photo-before-repair-closeup"
                          disabled={workflowLocked}
                        />
                        <label htmlFor="photo-before-repair-closeup" className="cursor-pointer">
                          <Camera className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                          <p className="text-sm text-slate-300">Tap to capture / upload</p>
                          {photos.before.length > 0 && (
                            <CheckCircle className="w-6 h-6 mx-auto mt-2 text-emerald-400" />
                          )}
                        </label>
                      </div>
                    </div>

                    {photos.before.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {photos.before.slice(-3).map((url) => (
                          <div key={url} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="Before repair"
                              className="h-24 w-full object-cover rounded-xl border border-slate-700 shadow-lg hover:scale-[1.02] transition-transform"
                            />
                            <button
                              type="button"
                              aria-label="Remove photo"
                              onClick={() => safeRemovePhoto("before", url)}
                              className={cx(
                                "absolute top-2 right-2 rounded-full p-1.5",
                                "bg-slate-950/80 border border-slate-600 text-slate-100",
                                "shadow-lg backdrop-blur",
                                "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                              )}
                              disabled={workflowLocked || isBusy}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {isUploading && <p className="text-xs text-slate-400 mt-1">Uploading photo…</p>}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setAndPersistStepAction(currentStep - 1)}
                      className="flex-1 border-slate-600 bg-slate-900/80 text-slate-50 hover:bg-slate-800 transition-all"
                    >
                      Back
                    </Button>

                    <Button
                      onClick={handleNextStepAction}
                      disabled={workflowLocked || photos.before.length < 1 || isBusy}
                      className="flex-1 bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all"
                    >
                      Start Repair
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Repair */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100">
                    <div className="flex gap-3 items-start text-sm">
                      <TriangleAlert className="w-4 h-4 mt-0.5" />
                      <div>
                        <strong>Heads up:</strong>{" "}
                        <span>
                          If a crack-out occurs during repair, report it on the final step — service still completes and
                          routes to invoice, but we flag replacement-required.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-100">Resin Type/Batch</Label>
                    <Input
                      value={resinUsed}
                      onChange={(e) => setResinUsedAction(e.target.value)}
                      placeholder="e.g., Delta Kits Pro Resin - Batch #12345"
                      className="!bg-slate-900/80 !border-slate-700 !text-slate-50 placeholder:!text-slate-500"
                      disabled={workflowLocked}
                    />
                  </div>

                  <div>
                    <Label className="text-slate-100">Work Notes</Label>
                    <Textarea
                      value={workNotes}
                      onChange={(e) => setWorkNotesAction(e.target.value)}
                      placeholder="Document repair process, any issues, etc..."
                      rows={4}
                      className="!bg-slate-900/80 !border-slate-700 !text-slate-50 placeholder:!text-slate-500"
                      disabled={workflowLocked}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-3 text-slate-100">
                    <div className="text-sm">
                      <strong>Repair checklist:</strong>
                      <ul className="list-disc ml-5 mt-2 space-y-1">
                        <li>Clean &amp; prep surface around damage</li>
                        <li>Drill/vent if necessary as per SOP</li>
                        <li>Apply resin and remove trapped air</li>
                        <li>Verify fill and clarity before curing</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setAndPersistStepAction(currentStep - 1)}
                      className="flex-1 border-slate-600 bg-slate-900/80 text-slate-50 hover:bg-slate-800 transition-all"
                    >
                      Back
                    </Button>

                    <Button
                      onClick={handleNextStepAction}
                      className="flex-1 bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all"
                      disabled={workflowLocked || isBusy}
                    >
                      Begin Curing
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Cure */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-100">Cure Time (minutes)</Label>
                    <Input
                      type="number"
                      value={cureTime}
                      onChange={(e) => setCureTimeAction(parseInt(e.target.value || "0", 10))}
                      min={15}
                      max={60}
                      className="!bg-slate-900/80 !border-slate-700 !text-slate-50 placeholder:!text-slate-500"
                      disabled={workflowLocked}
                    />
                  </div>

                  <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-amber-100">
                    <div className="flex gap-3 items-start text-sm">
                      <Clock className="w-4 h-4 mt-0.5" />
                      <div>
                        <strong>Curing in progress...</strong>{" "}
                        <span>Do not disturb the repair. Typical cure time is 30–45 minutes under UV light.</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setAndPersistStepAction(currentStep - 1)}
                      className="flex-1 border-slate-600 bg-slate-900/80 text-slate-50 hover:bg-slate-800 transition-all"
                    >
                      Back
                    </Button>

                    <Button
                      onClick={handleNextStepAction}
                      className="flex-1 bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all"
                      disabled={workflowLocked || isBusy}
                    >
                      Cure Complete
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Final Photos */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-slate-100">After repair close up</Label>
                    <div className="grid grid-cols-1 gap-4 mt-2">
                      <div className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center bg-slate-900/70 hover:bg-slate-900/90 transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUploadAction(e, "after_repair_closeup", "after")}
                          className="hidden"
                          id="photo-after-repair-closeup"
                          disabled={workflowLocked}
                        />
                        <label htmlFor="photo-after-repair-closeup" className="cursor-pointer">
                          <Camera className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                          <p className="text-sm text-slate-300">Tap to capture / upload</p>
                          {photos.after.length > 0 && (
                            <CheckCircle className="w-6 h-6 mx-auto mt-2 text-emerald-400" />
                          )}
                        </label>
                      </div>
                    </div>

                    {photos.after.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {photos.after.slice(-3).map((url) => (
                          <div key={url} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="After repair"
                              className="h-24 w-full object-cover rounded-xl border border-slate-700 shadow-lg hover:scale-[1.02] transition-transform"
                            />
                            <button
                              type="button"
                              aria-label="Remove photo"
                              onClick={() => safeRemovePhoto("after", url)}
                              className={cx(
                                "absolute top-2 right-2 rounded-full p-1.5",
                                "bg-slate-950/80 border border-slate-600 text-slate-100",
                                "shadow-lg backdrop-blur",
                                "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                              )}
                              disabled={workflowLocked || isBusy}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {isUploading && <p className="text-xs text-slate-400 mt-1">Uploading photo…</p>}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setAndPersistStepAction(currentStep - 1)}
                      className="flex-1 border-slate-600 bg-slate-900/80 text-slate-50 hover:bg-slate-800 transition-all"
                    >
                      Back
                    </Button>

                    <Button
                      onClick={handleNextStepAction}
                      disabled={workflowLocked || photos.after.length < 1 || isBusy}
                      className="flex-1 bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold shadow-[0_0_24px_rgba(56,189,248,0.25)] transition-all"
                    >
                      Proceed to Sign-Off
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 5: Complete & Sign */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">Completion Outcome</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Choose “Crack-out occurred” only if the crack expanded during repair — service still routes to
                          invoice, flagged replacement-required.
                        </p>
                      </div>
                      <Badge
                        className={
                          isCrackOut
                            ? "bg-amber-500 text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.25)]"
                            : "bg-emerald-500 text-slate-950 shadow-[0_0_18px_rgba(16,185,129,0.25)]"
                        }
                      >
                        {isCrackOut ? (
                          <>
                            <TriangleAlert className="w-3.5 h-3.5 mr-1" />
                            CRACK-OUT
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                            COMPLETED
                          </>
                        )}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRepairOutcomeAction("completed")}
                        className={cx(
                          "border-slate-600 bg-slate-950/30 text-slate-50 hover:bg-slate-800 transition-all",
                          repairOutcome === "completed" && "ring-2 ring-emerald-400/70 border-emerald-400/70"
                        )}
                        disabled={workflowLocked}
                      >
                        <ShieldCheck className="w-4 h-4 mr-2 text-emerald-300" />
                        Repair Completed
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRepairOutcomeAction("crack_out")}
                        className={cx(
                          "border-slate-600 bg-slate-950/30 text-slate-50 hover:bg-slate-800 transition-all",
                          repairOutcome === "crack_out" && "ring-2 ring-amber-400/70 border-amber-400/70"
                        )}
                        disabled={workflowLocked}
                      >
                        <TriangleAlert className="w-4 h-4 mr-2 text-amber-300" />
                        Crack-out Occurred
                      </Button>
                    </div>

                    {isCrackOut && (
                      <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100">
                          <div className="flex gap-3 items-start text-sm">
                            <TriangleAlert className="w-4 h-4 mt-0.5" />
                            <div>
                              <strong>Crack-out protocol:</strong>{" "}
                              <span>
                                Add cause, notes, and a photo. This flags replacement-required while routing cleanly.
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-slate-100">Crack-out Cause</Label>
                          <select
                            className="mt-2 w-full rounded-md bg-slate-900/70 border border-slate-700 text-sm text-slate-50 px-3 py-2"
                            value={crackOutCause}
                            onChange={(e) => setCrackOutCauseAction(e.target.value as any)}
                            disabled={workflowLocked}
                          >
                            <option value="" disabled>
                              Select cause…
                            </option>
                            {CRACK_OUT_CAUSES.map((c) => (
                              <option key={c.value} value={c.value} className="bg-slate-900 text-slate-50">
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label className="text-slate-100">Crack-out Notes</Label>
                          <Textarea
                            value={crackOutNotes}
                            onChange={(e) => setCrackOutNotesAction(e.target.value)}
                            placeholder="Describe what happened (min 10 chars)…"
                            rows={4}
                            className="!bg-slate-900/80 !border-slate-700 !text-slate-50 placeholder:!text-slate-500"
                            disabled={workflowLocked}
                          />
                        </div>

                        <div>
                          <Label className="text-slate-100">Crack-out Photo</Label>
                          <div className="mt-2 border-2 border-dashed border-amber-400/50 rounded-xl p-5 bg-slate-900/70 hover:bg-slate-900/90 transition-all">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleCrackOutUploadAction}
                              className="hidden"
                              id="photo-crackout"
                              disabled={workflowLocked}
                            />
                            <label
                              htmlFor="photo-crackout"
                              className="cursor-pointer flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3">
                                <Camera className="w-6 h-6 text-amber-300" />
                                <div>
                                  <p className="text-sm text-slate-200 font-medium">Upload crack-out photo</p>
                                  <p className="text-xs text-slate-400">Required for crack-out outcome</p>
                                </div>
                              </div>

                              {crackOutUploading ? (
                                <Badge className="bg-slate-800 text-slate-200 border border-slate-600">Uploading…</Badge>
                              ) : crackOutPhotoUrl ? (
                                <Badge className="bg-emerald-500 text-slate-950">
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                  Saved
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500 text-slate-950">
                                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                  Required
                                </Badge>
                              )}
                            </label>

                            {crackOutPhotoUrl && (
                              <div className="mt-3">
                                <p className="text-[11px] text-slate-400 mb-2">Preview:</p>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={crackOutPhotoUrl}
                                  alt="Crack-out photo"
                                  className="w-full max-h-64 object-cover rounded-xl border border-slate-700 shadow-lg"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tech signature */}
                  <SignatureCanvas
                    label="Tech signature (swipe)"
                    valueDataUrl={techSignatureDataUrl}
                    onChangeDataUrl={setTechSignatureDataUrlAction}
                    disabled={workflowLocked}
                    heightPx={170}
                  />

                  <div
                    className={cx(
                      "rounded-xl border px-4 py-3",
                      isCrackOut
                        ? "border-amber-500/70 bg-amber-500/10 text-amber-100"
                        : "border-emerald-500/70 bg-emerald-500/10 text-emerald-100"
                    )}
                  >
                    <div className="flex gap-3 items-start text-sm">
                      {isCrackOut ? (
                        <TriangleAlert className="w-4 h-4 mt-0.5" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mt-0.5" />
                      )}
                      <div>
                        <strong>{isCrackOut ? "Crack-out flagged." : "Ready to complete!"}</strong>{" "}
                        <span>
                          {isCrackOut
                            ? "You’ll still go to the invoice page — invoice will show crack-out + replacement-required."
                            : "Review all information with the customer before finalizing."}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setAndPersistStepAction(currentStep - 1)}
                      className="flex-1 border-slate-600 bg-slate-900/80 text-slate-50 hover:bg-slate-800 transition-all"
                    >
                      Back
                    </Button>

                    <Button
                      onClick={completeJobAction}
                      disabled={workflowLocked || !canComplete || completing}
                      className={cx(
                        "flex-1 text-slate-950 font-semibold transition-all shadow-[0_0_26px_rgba(16,185,129,0.18)]",
                        isCrackOut
                          ? "bg-amber-500 hover:bg-amber-600 shadow-[0_0_26px_rgba(245,158,11,0.18)]"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      )}
                    >
                      {completing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Completing...
                        </>
                      ) : isCrackOut ? (
                        <>
                          Complete Job (Crack-out)
                          <CheckCircle className="ml-2 w-5 h-5" />
                        </>
                      ) : (
                        <>
                          Complete Job
                          <CheckCircle className="ml-2 w-5 h-5" />
                        </>
                      )}
                    </Button>
                  </div>

                  {!canComplete && isCrackOut && (
                    <p className="text-xs text-amber-200/90">
                      Crack-out requires: cause + notes (min 10 chars) + photo + tech signature.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}