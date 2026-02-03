// components/admin/portal/AdminControlSurface.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { DollarSign, Users, Calendar, Clock } from "lucide-react";

type AdminControlSurfaceProps = {
  totalRevenue: number;
  activeAppointments: number;
  technicians: number;
};

export function AdminControlSurface({
  totalRevenue,
  activeAppointments,
  technicians,
}: AdminControlSurfaceProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative w-full md:w-[440px] h-[190px] md:h-[195px] rounded-2xl border border-white/10 overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 0% 0%, rgba(56,189,248,0.45), transparent 55%), radial-gradient(circle at 110% 100%, rgba(129,140,248,0.55), transparent 60%), linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,1))",
        boxShadow:
          "0 46px 140px rgba(15,23,42,0.96), 0 0 70px rgba(56,189,248,0.7)",
      }}
    >
      {/* soft vignette */}
      <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-soft-light">
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(120% 160% at 10% -10%, rgba(248,250,252,0.18), transparent 40%)",
          }}
        />
      </div>

      {/* background rails */}
      <div className="absolute inset-0 opacity-35 mix-blend-screen pointer-events-none">
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ggAdminGrid" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="45%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <g stroke="url(#ggAdminGrid)" strokeWidth="0.6">
            <line x1="6%" y1="20%" x2="94%" y2="10%" />
            <line x1="4%" y1="52%" x2="96%" y2="46%" />
            <line x1="8%" y1="82%" x2="92%" y2="80%" />
          </g>
        </svg>
      </div>

      {/* top row label */}
      <div className="absolute top-3 left-5 right-5 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-200">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Control Surface • Live</span>
        </div>
        <span className="rounded-full border border-slate-300/30 bg-slate-900/50 px-2 py-0.5 text-[10px] normal-case tracking-normal text-slate-100">
          Glass Guardian Admin
        </span>
      </div>

      {/* inner control module – slightly narrower so chips don’t overlap */}
      <div
        className="absolute left-4 top-9 h-[108px] w-[178px] rounded-3xl border border-cyan-300/60 bg-slate-950/80 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 26px 60px rgba(15,23,42,1), 0 0 32px rgba(56,189,248,0.85)",
        }}
      >
        {/* module header */}
        <div className="flex items-center justify-between px-3 pt-2 text-[10px] text-cyan-100/95">
          <span className="uppercase tracking-[0.18em]">Control</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/30 px-2 py-0.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
            Live
          </span>
        </div>

        {/* slider / lane */}
        <div className="relative mx-3 mt-3 h-7 rounded-full bg-slate-900/90 border border-slate-600/70 overflow-hidden">
          <div className="absolute inset-y-1 left-1 right-1 rounded-full border border-dashed border-slate-500/70" />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-10 rounded-full bg-cyan-300/95 shadow-[0_0_18px_rgba(34,211,238,0.9)]"
            initial={{ x: 6 }}
            animate={{ x: 70 }}
            transition={{
              duration: 3.3,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          >
            <div className="absolute inset-y-0.5 left-1 right-1 rounded-full bg-slate-950/70" />
          </motion.div>
        </div>

        {/* bottom stats inside module */}
        <div className="flex items-center justify-between px-3 pb-2 pt-1.5 text-[10px] text-slate-100/90 tabular-nums">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Active {activeAppointments}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            Techs {technicians}
          </span>
        </div>
      </div>

      {/* right side metrics – now with more room */}
      <div className="absolute inset-y-0 right-0 flex flex-col justify-center px-6 py-5 text-right text-slate-100 space-y-2">
        <div className="text-[10px] text-slate-300 leading-tight">
          <div className="text-[11px] font-medium text-slate-100">
            Total Revenue
          </div>
          <div className="opacity-80">Glass Guardian Admin</div>
        </div>

        <div className="text-2xl md:text-[26px] font-bold tabular-nums">
          ${totalRevenue.toFixed(0)}
        </div>

        <div className="flex justify-end gap-2 mt-1 text-[9px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 border border-emerald-300/30 whitespace-nowrap">
            <DollarSign className="h-3 w-3" />
            Flow Stable
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-1 border border-sky-300/30 whitespace-nowrap">
            <Calendar className="h-3 w-3" />
            Schedule Synced
          </span>
        </div>

        {/* lighter legend */}
        <div className="flex items-center justify-end gap-4 pt-1 text-[9px] text-slate-300/90">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            Ops load
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Tech coverage
          </span>
        </div>
      </div>
    </motion.div>
  );
}