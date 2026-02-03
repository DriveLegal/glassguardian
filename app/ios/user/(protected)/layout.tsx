// app/ios/user/(protected)/layout.tsx
"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LazyMotion, domAnimation, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  CalendarClock,
  Car,
  ReceiptText,
  Shield,
  Gift,
  Settings,
  Sparkles,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CosmicScene, usePageVisible } from "@/components/home/app/cosmic";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

function cn(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function tinyHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.(10);
    }
  } catch {}
}

const BASE = "/ios/user/dashboard";

type NavTab = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const TABS: NavTab[] = [
  { href: `${BASE}`, label: "Home", icon: LayoutDashboard },
  { href: `${BASE}/appointments`, label: "Appts", icon: CalendarClock },
  { href: `${BASE}/garage`, label: "Garage", icon: Car },
  { href: `${BASE}/pay`, label: "Invoices", icon: ReceiptText },
  { href: `${BASE}/warranties`, label: "Warranty", icon: Shield },
  { href: `${BASE}/referrals`, label: "Referrals", icon: Gift },
  { href: `${BASE}/settings`, label: "Settings", icon: Settings },
];

function isActiveTab(pathname: string, href: string) {
  const p = pathname.replace(/\/+$/, "");
  const h = href.replace(/\/+$/, "");
  if (h === BASE) return p === BASE || p === "/ios/user";
  return p === h || p.startsWith(h + "/");
}

/* ------------------ swipe nav (left/right) ------------------ */
const SWIPE_TABS: NavTab[] = [TABS[0], TABS[1], TABS[3], TABS[4], TABS[6]];

function normalizePath(p: string) {
  return (p || "").replace(/\/+$/, "");
}

function swipeIndexForPath(pathname: string) {
  const p = normalizePath(pathname);
  const exact = SWIPE_TABS.findIndex((t) => normalizePath(t.href) === p);
  if (exact !== -1) return exact;
  const prefix = SWIPE_TABS.findIndex((t) => p.startsWith(normalizePath(t.href) + "/"));
  return prefix === -1 ? 0 : prefix;
}

function isInteractiveEl(target: EventTarget | null) {
  if (!target || !(target as HTMLElement).closest) return false;
  const el = target as HTMLElement;
  return Boolean(
    el.closest(
      'input, textarea, select, button, a, [role="button"], [data-no-swipe="true"], [data-swipe="false"]'
    )
  );
}

type SwipePoint = { x: number; y: number; t: number };

export default function IOSUserProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || BASE;
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion ?? true;
  const pageVisible = usePageVisible();

  // Defer ambient for smoother iOS boot
  const [ambientReady, setAmbientReady] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      setAmbientReady(true);
    };
    const ric = (window as any).requestIdleCallback?.(go, { timeout: 900 });
    const t = window.setTimeout(go, 650);
    return () => {
      cancelled = true;
      try {
        (window as any).cancelIdleCallback?.(ric);
      } catch {}
      window.clearTimeout(t);
    };
  }, []);

  const enableAmbient = !reduce && pageVisible && ambientReady;

  const [userName, setUserName] = React.useState<string | null>(null);
  const [hasOpenInvoice, setHasOpenInvoice] = React.useState(false);

  // Hydrate name + invoice signal (best-effort)
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabaseClient.auth.getUser();
        const user = data?.user ?? null;
        if (!user || !mounted) return;

        const meta = user.user_metadata as any;
        const resolvedName = String(meta?.full_name || meta?.name || "").trim() || null;
        if (mounted) setUserName(resolvedName);

        // pull app_users row (optional, best-effort)
        let appUserId: string | null = null;
        try {
          if (user.email) {
            const { data: row, error } = await supabaseClient
              .from("app_users")
              .select("id")
              .ilike("email", user.email)
              .maybeSingle();
            if (!error && row) appUserId = (row as any).id ?? null;
          }
        } catch {}

        const invoiceRes = appUserId
          ? await supabaseClient
              .from("tech_invoices")
              .select("id, status, client_id")
              .eq("client_id", appUserId)
              .eq("status", "sent")
              .limit(1)
          : ({ data: [], error: null } as any);

        if (!mounted) return;
        if (!invoiceRes.error && invoiceRes.data) setHasOpenInvoice(invoiceRes.data.length > 0);
      } catch {}
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const personalized = React.useMemo(() => {
    const n = userName || "there";
    const base = [
      (x: string) => `Welcome back, ${x}.`,
      (x: string) => `${x}, your dashboard is synced.`,
      (x: string) => `All updates live here, ${x}.`,
      (x: string) => `Fast booking. Clean tracking, ${x}.`,
    ];
    const seed = (n || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const pick = base[Math.abs(seed) % base.length] ?? base[0];
    return `${pick(n)}${hasOpenInvoice ? " Invoice waiting under Invoices." : ""}`;
  }, [userName, hasOpenInvoice]);

  const onLogout = React.useCallback(async () => {
    tinyHaptic();
    try {
      await supabaseClient.auth.signOut();
    } catch {}
    router.replace("/");
    router.refresh?.();
  }, [router]);

  // ---------------- swipe core (NO horizontal page movement) ----------------
  const swipeStart = React.useRef<SwipePoint | null>(null);
  const swipeLast = React.useRef<SwipePoint | null>(null);
  const swiping = React.useRef(false);

  const commitSwipe = React.useCallback(
    (start: SwipePoint | null, end: SwipePoint | null) => {
      if (!start || !end) return;

      const dx = end.x - start.x;
      const dy = end.y - start.y;

      // ignore mostly-vertical gestures
      if (Math.abs(dy) > Math.abs(dx) * 1.15) return;

      const dt = Math.max(1, end.t - start.t);
      const vx = dx / dt;

      const DIST = 70;
      const FLICK = 0.55;

      const idx = swipeIndexForPath(pathname);

      // swipe left => next
      if (dx <= -DIST || vx <= -FLICK) {
        const next = SWIPE_TABS[Math.min(SWIPE_TABS.length - 1, idx + 1)];
        if (next?.href && normalizePath(next.href) !== normalizePath(pathname)) {
          tinyHaptic();
          router.push(next.href);
        }
        return;
      }

      // swipe right => prev
      if (dx >= DIST || vx >= FLICK) {
        const prev = SWIPE_TABS[Math.max(0, idx - 1)];
        if (prev?.href && normalizePath(prev.href) !== normalizePath(pathname)) {
          tinyHaptic();
          router.push(prev.href);
        }
      }
    },
    [pathname, router]
  );

  const onPointerDownCapture = React.useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    if (isInteractiveEl(e.target)) return;

    swiping.current = true;
    const p = { x: e.clientX, y: e.clientY, t: Date.now() };
    swipeStart.current = p;
    swipeLast.current = p;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  }, []);

  const onPointerMoveCapture = React.useCallback((e: React.PointerEvent) => {
    if (!swiping.current) return;
    if (e.pointerType === "mouse") return;
    swipeLast.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }, []);

  const onPointerUpCapture = React.useCallback(() => {
    const s = swipeStart.current;
    const last = swipeLast.current;
    swiping.current = false;
    swipeStart.current = null;
    swipeLast.current = null;
    commitSwipe(s, last);
  }, [commitSwipe]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        className={cn(
          "relative min-h-[100dvh] overflow-hidden bg-black text-white",
          // ✅ prevents the page from drifting/panning horizontally
          "overflow-x-hidden overscroll-x-none"
        )}
        style={{
          // ✅ key: allow vertical scrolling, but disable native horizontal panning
          touchAction: "pan-y",
          WebkitOverflowScrolling: "touch",
        }}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMoveCapture={onPointerMoveCapture}
        onPointerUpCapture={onPointerUpCapture}
      >
        {/* Cosmic background */}
        <CosmicScene
          variant="prime"
          enableParallax={enableAmbient}
          enableMeteors={enableAmbient}
          enableConstellation={enableAmbient}
        />

        {/* Top chrome (iOS) */}
<header
  className="relative z-10 mx-auto w-full max-w-[760px] px-4"
  style={{ paddingTop: "calc(env(safe-area-inset-top) + 55px)" }}
>
          <div className="relative overflow-hidden rounded-[28px] border border-cyan-300/25 bg-black/70 backdrop-blur-[22px] px-4 py-4 shadow-[0_34px_180px_rgba(0,0,0,0.96)] transform-gpu">
            <div className="pointer-events-none absolute -inset-36 bg-[radial-gradient(circle_at_25%_20%,rgba(96,220,255,0.22),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,110,220,0.18),transparent_50%)]" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="grid h-11 w-11 place-items-center rounded-[22px] border border-cyan-300/35 bg-cyan-500/10">
                  <Shield className="h-5 w-5 text-cyan-50" />
                </div>

                <div className="leading-tight min-w-0">
                  <div className="inline-flex items-center gap-2">
                    <div className="text-[11px] text-cyan-100/70">Glass Guardian</div>
                    <Badge className="border-white/10 bg-white/5 text-cyan-50/80">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      iOS
                    </Badge>
                  </div>

                  <div className="mt-1 text-[16px] font-semibold text-cyan-50 truncate">
                    {userName ? `Hey, ${userName}` : "Dashboard"}
                  </div>

                  <div className="mt-1 text-[12px] text-cyan-100/70">
                    {personalized}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={onLogout}
                className="h-9 rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                data-no-swipe="true"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="relative z-10 mx-auto w-full max-w-[760px] px-4 pb-28 pt-5">
          {children}
        </main>

        {/* iOS bottom tab bar */}
        <nav
          aria-label="iOS bottom navigation"
          className="fixed inset-x-0 bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),12px)]"
        >
          <div className="mx-auto w-full max-w-[760px] px-4">
            <div className="relative overflow-hidden rounded-[26px] border border-cyan-300/22 bg-black/70 backdrop-blur-[22px] shadow-[0_22px_140px_rgba(0,0,0,0.92)]">
              <div className="pointer-events-none absolute -inset-36 bg-[radial-gradient(circle_at_25%_20%,rgba(96,220,255,0.18),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,110,220,0.14),transparent_50%)]" />

              <div className="relative grid grid-cols-5 gap-1 p-2">
                {[TABS[0], TABS[1], TABS[3], TABS[4], TABS[6]].map((tab) => {
                  const active = isActiveTab(pathname, tab.href);
                  const Icon = tab.icon;
                  const urgent = tab.href === `${BASE}/pay` && hasOpenInvoice;
                  const isSettings = tab.href === `${BASE}/settings`;

                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={() => tinyHaptic()}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-colors",
                        active
                          ? "bg-white/[0.08] text-cyan-50"
                          : "text-cyan-100/70 hover:bg-white/[0.05]"
                      )}
                      aria-current={active ? "page" : undefined}
                      data-no-swipe="true"
                    >
                      <span
                        className={cn(
                          "relative grid h-9 w-9 place-items-center rounded-2xl border transition-colors",
                          active
                            ? "border-cyan-300/35 bg-cyan-500/10"
                            : "border-white/10 bg-white/[0.03]"
                        )}
                      >
                        <Icon className="h-4 w-4" />

                        {urgent && (
                          <span className="pointer-events-none absolute right-2 top-2 inline-flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/80 opacity-80" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
                          </span>
                        )}

                        {/* faint security hint ONLY on Settings tab */}
                        {isSettings && (
                          <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full border border-white/10 bg-white/[0.04] opacity-40">
                            <ShieldCheck className="h-2.5 w-2.5 text-cyan-100/70" />
                          </span>
                        )}
                      </span>

                      <span className="text-[10px] font-semibold tracking-wide">
                        {tab.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </LazyMotion>
  );
}