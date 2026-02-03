// components/user/security/SecurityBadge.tsx
"use client";

import * as React from "react";
import { m, AnimatePresence } from "framer-motion";
import { ShieldCheck, Lock, Server, EyeOff, Fingerprint } from "lucide-react";

type SecurityBadgeProps = {
  /** Optional: show "Verified" after the user is authenticated (best-effort). */
  showVerifiedIfAuthed?: boolean;
  /** Optional: compact style for tight headers */
  compact?: boolean;
  /** Optional: className */
  className?: string;
};

export default function SecurityBadge({
  showVerifiedIfAuthed = true,
  compact = false,
  className = "",
}: SecurityBadgeProps) {
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [isAuthed, setIsAuthed] = React.useState<boolean | null>(null);

  // Best-effort auth check (does NOT block UI)
  React.useEffect(() => {
    if (!showVerifiedIfAuthed) return;

    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/user/profile/get", { method: "GET" });
        if (cancelled) return;
        setIsAuthed(r.ok);
      } catch {
        if (!cancelled) setIsAuthed(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showVerifiedIfAuthed]);

  const verified = showVerifiedIfAuthed ? isAuthed === true : false;

  const title = verified ? "Secure session" : "Security";
  const subtitle = verified ? "Verified & protected" : "Protected by default";

  const hoverChips = [
    { icon: Lock, label: "AES-256 encryption" },
    { icon: Server, label: "Server-only decrypt" },
    { icon: Fingerprint, label: "Session gated" },
    { icon: EyeOff, label: "Minimal exposure" },
  ];

  const open = hovered || focused;

  return (
    <div className={className}>
      <m.div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative"
      >
        <div
          tabIndex={0}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          role="note"
          aria-label="Security badge. Hover for details."
          className={[
            "group relative w-full outline-none",
            compact ? "rounded-xl" : "rounded-2xl",
          ].join(" ")}
        >
          {/* Soft glow border (subtle) */}
          <div
            className={[
              "absolute -inset-[1px] rounded-2xl opacity-50 blur-[2px] transition-opacity",
              open ? "group-hover:opacity-90" : "group-hover:opacity-70",
              verified
                ? "bg-[conic-gradient(from_140deg_at_50%_50%,#34d399,transparent_25%,#60a5fa_50%,transparent_75%,#22c55e)]"
                : "bg-[conic-gradient(from_140deg_at_50%_50%,#60a5fa,transparent_25%,#a78bfa_50%,transparent_75%,#22d3ee)]",
            ].join(" ")}
          />

          <div
            className={[
              "relative overflow-hidden border border-white/12 bg-slate-950/60 text-slate-50 backdrop-blur-xl",
              "shadow-[0_14px_44px_rgba(2,6,23,0.55)]",
              compact ? "rounded-xl px-3 py-2" : "rounded-2xl px-4 py-3",
            ].join(" ")}
          >
            {/* subtle sheen */}
            <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/8 blur-2xl" />
            <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.18),transparent_40%),radial-gradient(circle_at_80%_120%,rgba(34,197,94,0.14),transparent_45%)]" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={[
                    "inline-flex h-10 w-10 items-center justify-center rounded-2xl border",
                    verified
                      ? "border-emerald-400/30 bg-emerald-500/8"
                      : "border-sky-400/30 bg-sky-500/8",
                  ].join(" ")}
                >
                  <ShieldCheck
                    className={[
                      "h-5 w-5",
                      verified ? "text-emerald-300" : "text-sky-300",
                    ].join(" ")}
                  />
                </span>

                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-wide">
                      {title}
                    </span>

                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold",
                        verified
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : "border-sky-400/30 bg-sky-500/10 text-sky-200",
                      ].join(" ")}
                    >
                      {verified ? "Verified" : "Active"}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300/90 truncate">
                    {subtitle}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hover / Focus tooltip (small + brief) */}
        <AnimatePresence initial={false}>
          {open && (
            <m.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none absolute left-1/2 z-50 w-[min(520px,calc(100vw-1.5rem))] -translate-x-1/2"
              style={{ top: "calc(100% + 10px)" }}
            >
              <div className="relative rounded-2xl border border-white/12 bg-slate-950/80 backdrop-blur-xl shadow-[0_18px_60px_rgba(2,6,23,0.70)]">
                <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-white/12 bg-slate-950/80" />

                <div className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {hoverChips.map((c) => {
                      const Icon = c.icon;
                      return (
                        <span
                          key={c.label}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.72rem] text-slate-200"
                        >
                          <Icon className="h-3.5 w-3.5 text-slate-200" />
                          {c.label}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-2 text-[0.72rem] leading-relaxed text-slate-300/90">
                    Sensitive data is encrypted at rest and only decrypted in protected
                    server routes.
                  </div>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </div>
  );
}