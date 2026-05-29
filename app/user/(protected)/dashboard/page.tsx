//app/user/(protected)/dashboard/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  LogIn,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import SectionCards from "@/components/user/dashboard/page/sectioncards";
import WaiverLogic, {
  useDashboardWaiverLogic,
} from "@/components/user/dashboard/page/waiverlogic";
import CrackOutTrigger from "@/components/user/dashboard/page/crackouttrig";
import DashboardHero from "@/components/user/dashboard/page/dashboardhero";
import RecentInvoicesPanel from "@/components/user/dashboard/page/recentinvoices";
import PostCompleteCard from "@/components/user/dashboard/page/postcompletecard";
import { useDashboardUser } from "@/components/user/dashboard/page/useDashboardUser";
import { useDashboardData } from "@/components/user/dashboard/page/useDashboardData";

const ENABLE_3D = process.env.NEXT_PUBLIC_ENABLE_3D !== "false";

export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion();

  const {
    user,
    loadingUser,
    sessionMissing,
    appUserName,
    loadingAppUserName,
    displayName,
    hardRefresh,
  } = useDashboardUser();

  const {
    appointments,
    vehicles,
    warranties,
    invoices,
    loadingData,
    loadingInvoices,
    activeAppointments,
    showPostCompleteMessage,
    showRecentInvoicesPanel,
  } = useDashboardData(user?.email);

  const {
    waiverDueAppointment,
    loadingWaivers,
    refreshWaiversAction,
    waiverForAppointmentIdAction,
  } = useDashboardWaiverLogic({
    appointments,
    userEmail: user?.email,
  });

  if (loadingUser) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-300" />
      </div>
    );
  }

  if (sessionMissing) {
    return (
      <div className="min-h-[70vh] grid place-items-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950/80 p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <TriangleAlert className="w-5 h-5 text-slate-200" />
            </div>

            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-50">
                Session not detected in the browser
              </h2>

              <p className="mt-1 text-xs text-slate-300">
                The server allowed this page, but your browser client couldn’t
                read the Supabase session cookie yet.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={hardRefresh}
                  className="bg-slate-100 hover:bg-white text-slate-950 font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>

                <Link href="/user/login?redirect=/user/dashboard">
                  <Button
                    variant="outline"
                    className="border-slate-700 bg-slate-900/70 text-slate-50 hover:bg-slate-800 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Go to login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex-1 w-full max-w-7xl mx-auto py-8 px-4 gg-dashboard-page"
    >
      <CrackOutTrigger appointments={appointments} />

      <WaiverLogic
        waiverDueAppointment={waiverDueAppointment}
        refreshWaiversAction={refreshWaiversAction}
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-50">
            Need another repair?
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Book a new Glass Guardian service in just a few clicks.
          </p>
        </div>

        <Link href="/user/dashboard/appointments/book" className="w-full sm:w-auto">
          <Button className="w-full bg-slate-100 text-slate-950 hover:bg-white font-semibold transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]">
            <Calendar className="mr-2 h-4 w-4" />
            Book service
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <DashboardHero
        displayName={displayName}
        loadingAppUserName={loadingAppUserName}
        showPersonalizing={!appUserName}
        enableVehicleHud={ENABLE_3D}
        activeAppointments={activeAppointments}
        vehicles={vehicles}
        warranties={warranties}
        totalServices={appointments.length}
        waiverForAppointmentIdAction={waiverForAppointmentIdAction}
      />

      {showPostCompleteMessage && (
        <PostCompleteCard
          displayName={displayName}
          loadingAppUserName={loadingAppUserName}
          showPersonalizing={!appUserName}
          enableVehicleHud={ENABLE_3D}
          activeAppointments={activeAppointments}
          vehicles={vehicles}
          warranties={warranties}
          totalServices={appointments.length}
          waiverForAppointmentIdAction={waiverForAppointmentIdAction}
        />
      )}

      {showRecentInvoicesPanel && (
        <RecentInvoicesPanel invoices={invoices} loadingInvoices={loadingInvoices} />
      )}

      <SectionCards
        activeAppointmentsCount={activeAppointments.length}
        vehiclesCount={vehicles.length}
        warrantiesCount={warranties.length}
        totalServicesCount={appointments.length}
      />

      {(loadingData || loadingWaivers || loadingInvoices) && (
        <div className="mt-6 text-center text-xs text-slate-400">
          Syncing your latest updates…
        </div>
      )}

      <style jsx global>{`
        .gg-dashboard-page {
          isolation: isolate;
        }

        .gg-glass-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.25rem;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background:
            radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.1), transparent 36%),
            radial-gradient(circle at 88% 95%, rgba(226, 232, 240, 0.07), transparent 42%),
            linear-gradient(
              135deg,
              rgba(30, 41, 59, 0.9),
              rgba(2, 6, 23, 0.86) 58%,
              rgba(15, 23, 42, 0.92)
            );
          background-clip: padding-box;
          backdrop-filter: blur(26px) saturate(1.2);
          box-shadow:
            0 30px 82px rgba(2, 6, 23, 0.74),
            0 0 0 1px rgba(255, 255, 255, 0.045),
            inset 0 1px 0 rgba(255, 255, 255, 0.13),
            inset 0 -1px 0 rgba(15, 23, 42, 0.8);
        }

        .gg-glass-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background:
            linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.09) 18%, transparent 32%),
            radial-gradient(circle at 50% 0%, rgba(226, 232, 240, 0.13), transparent 38%);
          opacity: 0.48;
          mix-blend-mode: screen;
        }

        .gg-card-graphite,
        .gg-card-warm {
          box-shadow:
            0 30px 82px rgba(2, 6, 23, 0.76),
            0 0 0 1px rgba(226, 232, 240, 0.11),
            0 0 38px rgba(226, 232, 240, 0.08),
            0 0 88px rgba(148, 163, 184, 0.055),
            inset 0 1px 0 rgba(255, 255, 255, 0.13);
        }

        .gg-card-particles {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle, rgba(255, 255, 255, 0.24) 0 1px, transparent 1.6px),
            radial-gradient(circle, rgba(226, 232, 240, 0.16) 0 1px, transparent 1.6px);
          background-size:
            46px 46px,
            74px 74px;
          background-position:
            0 0,
            14px 20px;
          opacity: 0.1;
          animation: gg-shimmer 18s linear infinite;
        }

        .gg-status-card {
          position: relative;
          overflow: hidden;
          transition:
            transform 220ms ease,
            background-color 220ms ease,
            border-color 220ms ease,
            box-shadow 220ms ease;
          box-shadow:
            0 16px 34px rgba(2, 6, 23, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.075);
        }

        .gg-status-card:hover {
          transform: translateY(-3px);
        }

        .gg-status-card::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          opacity: 0.44;
          pointer-events: none;
          mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          mask-composite: exclude;
          -webkit-mask-composite: xor;
          padding: 1px;
          animation: gg-border-pulse 3.2s ease-in-out infinite;
        }

        .gg-status-graphite {
          box-shadow:
            0 16px 38px rgba(2, 6, 23, 0.44),
            0 0 26px rgba(226, 232, 240, 0.075);
        }

        .gg-status-warm {
          box-shadow:
            0 16px 38px rgba(2, 6, 23, 0.44),
            0 0 30px rgba(226, 232, 240, 0.09);
        }

        .gg-status-graphite::before,
        .gg-status-warm::before {
          background: linear-gradient(
            90deg,
            rgba(226, 232, 240, 0),
            rgba(226, 232, 240, 0.82),
            rgba(148, 163, 184, 0.5),
            rgba(226, 232, 240, 0)
          );
        }

        .gg-live-dot {
          width: 0.48rem;
          height: 0.48rem;
          border-radius: 999px;
          background: rgb(226, 232, 240);
          box-shadow: 0 0 0 rgba(226, 232, 240, 0.68);
          animation: gg-live-pulse 1.9s ease-out infinite;
        }

        @keyframes gg-live-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(226, 232, 240, 0.62);
          }
          70% {
            box-shadow: 0 0 0 9px rgba(226, 232, 240, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(226, 232, 240, 0);
          }
        }

        @keyframes gg-shimmer {
          0% {
            background-position:
              0 0,
              14px 20px;
          }
          100% {
            background-position:
              120px 80px,
              180px 140px;
          }
        }

        @keyframes gg-border-pulse {
          0%,
          100% {
            opacity: 0.24;
            filter: blur(0px);
          }
          50% {
            opacity: 0.72;
            filter: blur(0.25px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .gg-card-particles,
          .gg-live-dot,
          .gg-status-card::before {
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
}