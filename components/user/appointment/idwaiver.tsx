// components/user/appointment/idwaiver.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileSignature,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { WAIVER_VERSION } from "@/lib/waivers/glassGuardianWaiver";

type IdWaiverProps = {
  fullName: string;
  initials: string;
  signedDateLabel: string;
  repairAmount: number;
  signatureDataUrl: string | null;
};

type WaiverSection = {
  n: number;
  title: string;
  icon: React.ElementType;
  text: string;
};

function getSections(repairAmount: number): WaiverSection[] {
  return [
    {
      n: 1,
      title: "Authorization to Perform Service",
      icon: Wrench,
      text: "I authorize Glass Guardian Chip & Crack Repair to inspect and perform windshield repair services on my vehicle. I represent that I am the vehicle owner or otherwise have authority to approve this service.",
    },
    {
      n: 2,
      title: "Nature of Windshield Repair",
      icon: ShieldCheck,
      text: "I understand that windshield repair is intended to improve the structural stability of the damaged area and help reduce the likelihood of further spreading. I understand that repair is not a cosmetic restoration and that visible marks, blemishes, shadows, or distortion may remain after service.",
    },
    {
      n: 3,
      title: "Acknowledgment of Risk",
      icon: TriangleAlert,
      text: "I understand that glass damage may spread before, during, or after the repair attempt due to existing stress, temperature changes, road vibration, vehicle body flex, moisture, contamination, or hidden micro-fractures in the glass.",
    },
    {
      n: 4,
      title: "Unsuccessful Repair Attempt",
      icon: BadgeCheck,
      text: `If the repair cannot be completed because the damage spreads during the repair attempt, Glass Guardian will refund the repair amount paid for this service, up to $${repairAmount}. This refund is limited to the amount paid for the repair service only.`,
    },
    {
      n: 5,
      title: "Pre-Existing Conditions and Limitation",
      icon: CheckCircle2,
      text: "I understand that Glass Guardian is not responsible for pre-existing stress, hidden cracks, old damage, prior repairs, manufacturing defects, aftermarket glass defects, or spreading that occurs outside Glass Guardian’s control, except where prohibited by applicable law.",
    },
    {
      n: 6,
      title: "Documentation Authorization",
      icon: Camera,
      text: "I authorize Glass Guardian to photograph the windshield damage, repair process, and completed repair for service records, warranty documentation, quality control, and claim-support purposes when applicable.",
    },
    {
      n: 7,
      title: "Customer Acknowledgment and Consent",
      icon: HelpCircle,
      text: "I acknowledge that I have had the opportunity to ask questions before service begins. I confirm that the information I provided is accurate and that I am signing this waiver voluntarily on the day of my appointment.",
    },
  ];
}

export function IdWaiver({
  fullName,
  initials,
  signedDateLabel,
  repairAmount,
  signatureDataUrl,
}: IdWaiverProps) {
  const initialsLabel = initials || "____";
  const printedName = fullName || "CUSTOMER NAME WILL APPEAR HERE";
  const sections = React.useMemo(() => getSections(repairAmount), [repairAmount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.08),transparent_30%,rgba(16,185,129,0.08)_65%,transparent)]" />
      </div>

      <div className="relative space-y-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-200">
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <FileSignature className="h-5 w-5" />
                </motion.div>
                <span className="text-xs font-bold uppercase tracking-[0.22em]">
                  Glass Guardian Waiver
                </span>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white">
                Service Authorization & Repair Acknowledgment
              </h3>

              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Please review each section carefully. Your initials confirm that you have read,
                understood, and acknowledged each item before service begins.
              </p>
            </div>

            <div className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              {WAIVER_VERSION}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {sections.map((section, index) => {
            const Icon = section.icon;

            return (
              <motion.div
                key={section.n}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.045 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-emerald-300/25 hover:bg-white/[0.07]"
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-[waiverSweep_3.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-emerald-300/[0.035] to-transparent" />
                </div>

                <div className="relative flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-slate-200">
                          {section.n}
                        </span>
                        <h4 className="font-semibold text-slate-100">{section.title}</h4>
                      </div>

                      <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold tracking-wider text-emerald-100">
                        Initials: {initialsLabel}
                      </div>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{section.text}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              Customer Printed Name
            </div>
            <div className="text-base font-bold text-white">{printedName}</div>
            <div className="mt-2 text-m font-bold text-slate-400">Date: {signedDateLabel}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Customer Signature
            </div>

            {signatureDataUrl ? (
              <div className="rounded-xl border border-emerald-300/20 bg-slate-950/60 p-3">
                <img
                  src={signatureDataUrl}
                  alt="Customer signature"
                  className="max-h-20 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-950/45 text-sm text-slate-500">
                Signature will appear here after signing below
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes waiverSweep {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </motion.div>
  );
}