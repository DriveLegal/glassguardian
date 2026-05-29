// app/tech/(protected)/dashboard/schedule/ScheduleNoSSR.tsx
"use client";

import dynamic from "next/dynamic";

// ✅ MUST be inside a Client Component to use ssr:false
const TechScheduleClient = dynamic(() => import("./ScheduleClient"), {
  ssr: false,
  loading: () => (
    <div className="relative min-h-[70vh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 480px at -10% -10%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(840px 520px at 110% 0%, rgba(52,211,153,0.22), transparent 60%), linear-gradient(180deg, #020617, #020617 40%, #020617 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' width='128' height='128' viewBox='0 0 128 128'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/></filter><rect width='128' height='128' filter='url(#n)' opacity='0.32'/></svg>\")",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 backdrop-blur-xl shadow-[0_16px_80px_rgba(15,23,42,0.85)] p-6">
          <div className="text-slate-50 font-extrabold text-xl">
            Loading Tech Command Center…
          </div>
          <div className="mt-2 text-sm text-slate-300">
            Initializing schedule UI
          </div>

          <div className="mt-6 space-y-3">
            <div className="h-10 rounded-xl bg-slate-800/70 border border-slate-700/70 animate-pulse" />
            <div className="h-20 rounded-xl bg-slate-800/70 border border-slate-700/70 animate-pulse" />
            <div className="h-20 rounded-xl bg-slate-800/70 border border-slate-700/70 animate-pulse" />
            <div className="h-20 rounded-xl bg-slate-800/70 border border-slate-700/70 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  ),
});

export default function ScheduleNoSSR() {
  return <TechScheduleClient />;
}