// app/admin/(protected)/layout.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  BellRing,
  LogOut,
  Sparkles,
  ChevronRight,
  Activity,
  LayoutDashboard,
  PanelsTopLeft,
  CalendarDays,
  Users,
  ReceiptText,
  Wrench,
  ClipboardList,
  BadgeCheck,
  MessageSquare,
  Bell,
  CreditCard,
  BarChart3,
  LifeBuoy,
  CarFront,
  UserRound,
  Menu,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";

type AnyObj = Record<string, any>;
type IconType = React.ComponentType<{ className?: string }>;

type NavItem = {
  label: string;
  href: string;
  icon: IconType;
};

type NavGroup = {
  label: string;
  primaryHref: string;
  icon: IconType;
  items?: NavItem[];
};

async function isAdminByTable(email: string): Promise<boolean> {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();

  const { data, error } = await supabaseClient
    .from("admins")
    .select("role, is_active")
    .eq("email", normalized)
    .maybeSingle();

  if (error) return false;

  return (
    !!data &&
    data.is_active === true &&
    (data.role === "admin" || data.role === "support")
  );
}

function resolveRole(
  u: { app_metadata?: AnyObj; user_metadata?: AnyObj } | null | undefined
): string | null {
  if (!u) return null;
  const r = (u.app_metadata?.role ?? u.user_metadata?.role ?? null) as
    | string
    | null;
  return typeof r === "string" ? r : null;
}

const ADMIN_NAV: NavGroup[] = [
  {
    label: "Portal",
    primaryHref: "/admin/portal",
    icon: LayoutDashboard,
  },
  {
    label: "Operations",
    primaryHref: "/admin/portal/appointments",
    icon: ClipboardList,
    items: [
      {
        label: "Appointments",
        href: "/admin/portal/appointments",
        icon: CalendarDays,
      },
      {
        label: "Calendar",
        href: "/admin/portal/calendar",
        icon: CalendarDays,
      },
      {
        label: "Booking leads",
        href: "/admin/portal/bookingleads",
        icon: BellRing,
      },
    ],
  },
  {
    label: "Customers",
    primaryHref: "/admin/portal/customers",
    icon: Users,
    items: [
      {
        label: "Customers",
        href: "/admin/portal/customers",
        icon: UserRound,
      },
      {
        label: "Warranties",
        href: "/admin/portal/warranties",
        icon: BadgeCheck,
      },
      {
        label: "Messages",
        href: "/admin/portal/messages",
        icon: MessageSquare,
      },
      {
        label: "Notifications",
        href: "/admin/portal/notifications",
        icon: Bell,
      },
      {
        label: "Referral requests",
        href: "/admin/portal/referral-requests",
        icon: Sparkles,
      },
    ],
  },
  {
    label: "Billing & Analytics",
    primaryHref: "/admin/portal/invoices",
    icon: ReceiptText,
    items: [
      {
        label: "Invoices",
        href: "/admin/portal/invoices",
        icon: ReceiptText,
      },
      {
        label: "Pricing",
        href: "/admin/portal/pricing",
        icon: CreditCard,
      },
      {
        label: "Insurance",
        href: "/admin/portal/insurance",
        icon: CarFront,
      },
      {
        label: "Analytics",
        href: "/admin/portal/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Team & Support",
    primaryHref: "/admin/portal/technicians",
    icon: Wrench,
    items: [
      {
        label: "Technicians",
        href: "/admin/portal/technicians",
        icon: Wrench,
      },
      {
        label: "Support",
        href: "/admin/portal/support",
        icon: LifeBuoy,
      },
    ],
  },
];

function pathStartsWith(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string | null, group: NavGroup): boolean {
  if (group.label === "Portal") return pathname === group.primaryHref;

  if (group.items?.length) {
    return group.items.some((item) => pathStartsWith(pathname, item.href));
  }

  return pathStartsWith(pathname, group.primaryHref);
}

function shortMobileLabel(label: string) {
  if (label === "Billing & Analytics") return "Billing";
  if (label === "Team & Support") return "Team";
  return label;
}

function AmbientGlow({
  className,
  delay = 0,
  reduced = false,
}: {
  className?: string;
  delay?: number;
  reduced?: boolean;
}) {
  if (reduced) return <div className={className} aria-hidden="true" />;

  return (
    <motion.div
      aria-hidden="true"
      className={className}
      initial={{ opacity: 0.5, scale: 0.96 }}
      animate={{
        opacity: [0.38, 0.62, 0.42],
        scale: [0.96, 1.06, 0.98],
        x: [0, 12, -8, 0],
        y: [0, -10, 8, 0],
      }}
      transition={{
        duration: 12,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHapticFiredRef = React.useRef(false);

  const [state, setState] = React.useState({
    ready: false,
    allowed: false,
    name: "Admin",
  });

  const [condensed, setCondensed] = React.useState(false);
  const [refReqCount, setRefReqCount] = React.useState<number>(0);
  const [sidebarHovered, setSidebarHovered] = React.useState(false);

  const sidebarExpanded = sidebarHovered;

  function fireSoftHaptic() {
    if (typeof window === "undefined") return;
    if (!("vibrate" in navigator)) return;

    try {
      navigator.vibrate(8);
    } catch {
      // no-op
    }
  }

  function handleSidebarMouseEnter() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    hoverTimerRef.current = setTimeout(() => {
      setSidebarHovered(true);

      if (!hasHapticFiredRef.current) {
        hasHapticFiredRef.current = true;
        fireSoftHaptic();
      }
    }, 150);
  }

  function handleSidebarMouseLeave() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    hasHapticFiredRef.current = false;
    setSidebarHovered(false);
  }

  React.useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let redirected = false;
    let unsub: (() => void) | null = null;

    const allow = (name: string) => {
      if (!mounted) return;
      setState({ ready: true, allowed: true, name });
    };

    const block = () => {
      if (!mounted || redirected) return;

      redirected = true;
      setState({ ready: true, allowed: false, name: "Admin" });
      router.replace(
        `/admin/login?redirect=${encodeURIComponent(
          pathname || "/admin/portal"
        )}`
      );
    };

    async function checkSession() {
      const { data } = await supabaseClient.auth.getSession();

      if (!mounted || redirected) return;

      const session = data?.session ?? null;
      const user = session?.user ?? null;
      const email = user?.email ?? null;
      const metaRole = resolveRole(user);

      if (user && (metaRole === "admin" || metaRole === "support")) {
        const displayName =
          (user.user_metadata as AnyObj)?.full_name ||
          email?.split("@")[0] ||
          "Admin";
        allow(displayName);
        return;
      }

      if (user && email) {
        const ok = await isAdminByTable(email);

        if (!mounted || redirected) return;

        if (ok) {
          const displayName =
            (user.user_metadata as AnyObj)?.full_name ||
            email.split("@")[0] ||
            "Admin";
          allow(displayName);
          return;
        }
      }

      const devRole = String(readDevRoleFromCookie() ?? "");
      if (devRole === "admin" || devRole === "support") {
        const dev = makeDevUser("admin");
        allow(dev.user_metadata?.full_name || `Dev ${devRole}`);
        return;
      }

      block();
    }

    checkSession();

    const { data: sub } = supabaseClient.auth.onAuthStateChange(
      async (_evt, sess) => {
        if (!mounted || redirected) return;

        const user = sess?.user ?? null;
        const email = user?.email ?? null;
        const role = resolveRole(user);

        if (user && (role === "admin" || role === "support")) {
          const displayName =
            (user.user_metadata as AnyObj)?.full_name ||
            email?.split("@")[0] ||
            "Admin";
          allow(displayName);
          return;
        }

        if (user && email) {
          const ok = await isAdminByTable(email);

          if (!mounted || redirected) return;

          if (ok) {
            const displayName =
              (user.user_metadata as AnyObj)?.full_name ||
              email.split("@")[0] ||
              "Admin";
            allow(displayName);
            return;
          }
        }

        const devRole = String(readDevRoleFromCookie() ?? "");
        if (devRole === "admin" || devRole === "support") {
          const dev = makeDevUser("admin");
          allow(dev.user_metadata?.full_name || `Dev ${devRole}`);
          return;
        }

        block();
      }
    );

    unsub = () => sub?.subscription?.unsubscribe();

    return () => {
      mounted = false;
      unsub?.();
    };
  }, [router, pathname]);

  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setCondensed((prev) => {
        const next = y > 24;
        return prev === next ? prev : next;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    let mounted = true;

    async function loadCount() {
      const { count, error } = await supabaseClient
        .from("referral_invite_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");

      if (!mounted) return;

      if (error) {
        setRefReqCount(0);
        return;
      }

      setRefReqCount(count ?? 0);
    }

    loadCount();

    const ch = supabaseClient
      .channel("admin-referral-invite-requests-badge")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "referral_invite_requests",
        },
        () => loadCount()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabaseClient.removeChannel(ch);
    };
  }, []);

  if (!state.ready) {
    return (
      <div className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-[#040812] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(900px_540px_at_12%_0%,rgba(34,211,238,0.18),transparent_48%),radial-gradient(860px_520px_at_100%_100%,rgba(99,102,241,0.18),transparent_45%),linear-gradient(180deg,#050913_0%,#09111f_48%,#050914_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:38px_38px] opacity-[0.08]" />

        <motion.div
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.98 }
          }
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
          className="relative mx-4 rounded-[28px] border border-white/10 bg-white/[0.05] px-8 py-7 shadow-[0_25px_70px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
        >
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-cyan-300/20 blur-xl" />
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] shadow-[0_18px_40px_rgba(34,211,238,0.14)]">
                <ShieldCheck className="h-6 w-6 text-cyan-100" />
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold tracking-wide text-white/92">
                Checking admin access…
              </div>
              <div className="mt-1 text-xs text-white/48">
                Verifying session and permissions
              </div>
            </div>
          </div>
        </motion.div>

        <style jsx global>{`
          html,
          body {
            min-height: 100%;
            background: #040812;
          }
        `}</style>
      </div>
    );
  }

  if (!state.allowed) return null;

  const activeGroup =
    ADMIN_NAV.find((group) => isGroupActive(pathname, group)) ?? ADMIN_NAV[0];

  async function handleLogout() {
    await supabaseClient.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <div className="admin-mobile-fullscreen min-h-[100svh] overflow-x-clip bg-[#040812] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1000px_620px_at_10%_0%,rgba(34,211,238,0.14),transparent_46%),radial-gradient(820px_560px_at_92%_100%,rgba(99,102,241,0.16),transparent_44%),radial-gradient(700px_420px_at_50%_20%,rgba(14,165,233,0.08),transparent_55%),linear-gradient(180deg,#050913_0%,#09111d_44%,#040811_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:36px_36px] opacity-[0.08]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_55%,rgba(0,0,0,0.32)_100%)]" />

        <AmbientGlow
          reduced={!!prefersReducedMotion}
          className="absolute left-[-10%] top-[3%] h-[20rem] w-[20rem] rounded-full bg-cyan-400/12 blur-3xl"
        />
        <AmbientGlow
          reduced={!!prefersReducedMotion}
          delay={0.8}
          className="absolute right-[-6%] top-[8%] h-[18rem] w-[18rem] rounded-full bg-indigo-500/14 blur-3xl"
        />
        <AmbientGlow
          reduced={!!prefersReducedMotion}
          delay={1.6}
          className="absolute bottom-[-8%] left-[22%] h-[16rem] w-[16rem] rounded-full bg-sky-400/10 blur-3xl"
        />
      </div>

      {/* Side header: medium / smaller desktop windows only */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarExpanded ? 284 : 88 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="fixed left-0 top-0 z-40 hidden h-screen border-r border-white/10 bg-[#07111f]/82 shadow-[24px_0_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:block xl:hidden"
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="relative border-b border-white/8 p-4">
            <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

            <div className="flex items-center gap-3">
              <motion.div
                animate={
                  !sidebarExpanded
                    ? { scale: [1, 1.035, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/18 bg-white/[0.06] shadow-[0_18px_38px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.12)]"
              >
                <PanelsTopLeft className="h-5 w-5 text-cyan-100" />
              </motion.div>

              <AnimatePresence initial={false}>
                {sidebarExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="min-w-0"
                  >
                    <div className="truncate text-[10px] uppercase tracking-[0.24em] text-cyan-100/56">
                      Glass Guardian
                    </div>
                    <div className="truncate text-sm font-semibold text-white/92">
                      Admin Control
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {sidebarExpanded && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-white/60"
                    title="Hover area expanded"
                  >
                    <Menu className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {sidebarExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 8, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="truncate text-[10px] uppercase tracking-[0.2em] text-white/42">
                      Portal access
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-white/88">
                      {state.name}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
            <div className="space-y-2">
              {ADMIN_NAV.map((group) => {
                const active = isGroupActive(pathname, group);
                const Icon = group.icon;

                return (
                  <div key={group.label}>
                    <Link
                      href={group.primaryHref}
                      title={!sidebarExpanded ? group.label : undefined}
                      className={[
                        "admin-side-link relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-sm transition-all duration-200",
                        active
                          ? "border-cyan-300/34 bg-cyan-300/13 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_16px_34px_rgba(2,8,23,0.34),0_0_34px_rgba(56,189,248,0.12)]"
                          : "border-white/8 bg-white/[0.035] text-white/66 hover:border-cyan-300/18 hover:bg-white/[0.06] hover:text-white",
                      ].join(" ")}
                    >
                      {active && (
                        <motion.span
                          layoutId="admin-side-active-glow"
                          className="absolute inset-0 rounded-2xl bg-[radial-gradient(240px_70px_at_20%_0%,rgba(125,211,252,0.22),transparent_70%)]"
                          transition={{
                            type: "spring",
                            stiffness: 420,
                            damping: 34,
                          }}
                        />
                      )}

                      <motion.span
                        whileHover={
                          !sidebarExpanded ? { scale: 1.12 } : { scale: 1.03 }
                        }
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/15"
                      >
                        <Icon className="h-4 w-4" />
                      </motion.span>

                      <AnimatePresence initial={false}>
                        {sidebarExpanded && (
                          <motion.span
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-2"
                          >
                            <span className="truncate">{group.label}</span>
                            {group.label === "Customers" &&
                              refReqCount > 0 && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.95)]" />
                              )}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>

                    <AnimatePresence initial={false}>
                      {sidebarExpanded && active && group.items?.length ? (
                        <motion.div
                          initial={
                            prefersReducedMotion
                              ? false
                              : { opacity: 0, height: 0 }
                          }
                          animate={
                            prefersReducedMotion
                              ? {}
                              : { opacity: 1, height: "auto" }
                          }
                          exit={
                            prefersReducedMotion
                              ? {}
                              : { opacity: 0, height: 0 }
                          }
                          className="ml-4 mt-2 space-y-1 overflow-hidden border-l border-white/8 pl-3"
                        >
                          {group.items.map((item) => {
                            const itemActive = pathStartsWith(
                              pathname,
                              item.href
                            );
                            const ItemIcon = item.icon;
                            const isReferralReq =
                              item.href === "/admin/portal/referral-requests";

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={[
                                  "relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition",
                                  itemActive
                                    ? "bg-cyan-300/12 text-cyan-50"
                                    : "text-white/58 hover:bg-white/[0.055] hover:text-white",
                                ].join(" ")}
                              >
                                <ItemIcon className="h-3.5 w-3.5" />
                                <span className="truncate">{item.label}</span>
                                {isReferralReq && refReqCount > 0 && (
                                  <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950">
                                    {refReqCount > 99 ? "99+" : refReqCount}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/8 p-3">
            <AnimatePresence initial={false}>
              {sidebarExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: 8, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <Link
                    href="/admin/portal/referral-requests"
                    className={[
                      "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition",
                      refReqCount > 0
                        ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                        : "border-emerald-300/28 bg-emerald-300/10 text-emerald-100",
                    ].join(" ")}
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    Referral
                    {refReqCount > 0 && (
                      <span className="inline-flex min-w-[19px] items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950">
                        {refReqCount > 99 ? "99+" : refReqCount}
                      </span>
                    )}
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleLogout}
              className="admin-logout-pill relative flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/22 bg-red-300/10 px-3 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-red-100 shadow-[0_12px_24px_rgba(248,113,113,0.08),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:bg-red-300/14"
            >
              <LogOut className="h-4 w-4" />
              {sidebarExpanded && <span>Log out</span>}
            </button>
          </div>
        </div>
      </motion.aside>

      <div className="relative z-10 min-h-[100svh] pt-[calc(env(safe-area-inset-top)+82px)] transition-[padding] duration-300 md:pl-[88px] md:pt-0 xl:pl-0 xl:pt-[154px]">
        {/* Full desktop header */}
        <header
          className={[
            "fixed left-0 right-0 top-0 z-50 hidden border-b border-white/8 bg-[#07111f]/72 backdrop-blur-2xl transition-all duration-300 xl:block",
            condensed ? "py-2" : "py-3",
          ].join(" ")}
        >
          <div className="mx-auto w-full max-w-[1180px] px-4">
            <div
              className={[
                "relative mx-auto flex items-center justify-between gap-4 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-5 shadow-[0_18px_50px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300",
                condensed ? "min-h-[64px]" : "min-h-[76px]",
              ].join(" ")}
            >
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
              <div className="absolute inset-y-0 left-0 w-[38%] bg-[radial-gradient(420px_180px_at_10%_0%,rgba(255,255,255,0.10),transparent_68%)]" />
              <div className="absolute inset-y-0 right-0 w-[32%] bg-[radial-gradient(320px_160px_at_100%_0%,rgba(56,189,248,0.12),transparent_66%)]" />

              <div className="relative z-10 flex min-w-0 items-center gap-3">
                <motion.div
                  initial={
                    prefersReducedMotion
                      ? false
                      : { opacity: 0, scale: 0.9, y: 8 }
                  }
                  animate={
                    prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }
                  }
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={[
                    "relative grid shrink-0 place-items-center rounded-2xl border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] shadow-[0_18px_38px_rgba(34,211,238,0.14),inset_0_1px_0_rgba(255,255,255,0.14)]",
                    condensed ? "h-10 w-10" : "h-11 w-11",
                  ].join(" ")}
                >
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_46%)]" />
                  <PanelsTopLeft className="relative z-10 h-5 w-5 text-cyan-100" />
                </motion.div>

                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[10px] uppercase tracking-[0.26em] text-cyan-100/58">
                    Glass Guardian • Admin Control
                  </div>
                  <div className="truncate text-sm font-semibold text-white/92 md:text-[15px]">
                    Portal access for{" "}
                    <span className="bg-gradient-to-r from-cyan-200 via-sky-200 to-indigo-200 bg-clip-text text-transparent">
                      {state.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex shrink-0 items-center gap-2.5 md:gap-3">
                <Link
                  href="/admin/portal/referral-requests"
                  className={[
                    "group relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-all duration-200",
                    refReqCount > 0
                      ? "border-amber-300/35 bg-amber-300/10 text-amber-100 shadow-[0_12px_26px_rgba(251,191,36,0.08),inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-amber-300/14"
                      : "border-emerald-300/28 bg-emerald-300/10 text-emerald-100 shadow-[0_12px_24px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-emerald-300/14",
                  ].join(" ")}
                >
                  <BellRing className="h-3.5 w-3.5 opacity-90" />
                  <span>Referral</span>
                  {refReqCount > 0 && (
                    <span className="inline-flex min-w-[19px] items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 shadow-[0_0_18px_rgba(252,211,77,0.45)]">
                      {refReqCount > 99 ? "99+" : refReqCount}
                    </span>
                  )}
                </Link>

                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-300/8 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-100/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Activity className="h-3.5 w-3.5" />
                  Live Ops
                </div>

                <button
                  onClick={handleLogout}
                  className="admin-logout-pill relative inline-flex items-center gap-2 rounded-full border border-red-300/22 bg-red-300/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-red-100 shadow-[0_12px_24px_rgba(248,113,113,0.08),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:bg-red-300/14"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>

          <nav className="mt-3 border-t border-white/6 bg-transparent">
            <div className="mx-auto w-full max-w-[1180px] px-4">
              <div
                className={[
                  "mx-auto flex justify-center gap-2 overflow-x-auto px-2 pr-2 transition-all duration-300 scrollbar-none",
                  condensed ? "py-2" : "py-3",
                ].join(" ")}
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {ADMIN_NAV.map((group, idx) => {
                  const active = isGroupActive(pathname, group);
                  const Icon = group.icon;

                  return (
                    <motion.div
                      key={group.label}
                      initial={
                        prefersReducedMotion ? false : { opacity: 0, y: 8 }
                      }
                      animate={
                        prefersReducedMotion ? {} : { opacity: 1, y: 0 }
                      }
                      transition={{ duration: 0.28, delay: idx * 0.03 }}
                    >
                      <Link
                        href={group.primaryHref}
                        className={[
                          "admin-nav-primary relative inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 md:text-[13px]",
                          active
                            ? "border-cyan-300/34 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(59,130,246,0.12))] text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_16px_34px_rgba(2,8,23,0.42),inset_0_1px_0_rgba(255,255,255,0.14)]"
                            : "border-white/10 bg-white/[0.045] text-white/72 shadow-[0_10px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-cyan-300/18 hover:bg-white/[0.07] hover:text-white",
                        ].join(" ")}
                      >
                        <Icon className="h-3.5 w-3.5 opacity-80" />
                        {group.label}
                        {group.label === "Customers" && refReqCount > 0 && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.95)]" />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <AnimatePresence initial={false}>
                {activeGroup.items && activeGroup.items.length > 0 && (
                  <motion.div
                    key={activeGroup.label}
                    initial={
                      prefersReducedMotion ? false : { opacity: 0, y: -4 }
                    }
                    animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? {} : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="pb-4"
                  >
                    <div
                      className="mx-auto flex justify-center gap-2 overflow-x-auto px-2 pr-2 scrollbar-none"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      {activeGroup.items.map((item) => {
                        const active = pathStartsWith(pathname, item.href);
                        const isReferralReq =
                          item.href === "/admin/portal/referral-requests";
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={[
                              "admin-nav-secondary relative inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200 md:text-xs",
                              active
                                ? "border-cyan-300/36 bg-cyan-300/14 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.22),0_14px_28px_rgba(3,7,18,0.34),inset_0_1px_0_rgba(255,255,255,0.12)]"
                                : "border-white/10 bg-white/[0.04] text-white/70 shadow-[0_8px_22px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-cyan-300/18 hover:bg-white/[0.06] hover:text-white",
                            ].join(" ")}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span>{item.label}</span>
                            {active && (
                              <ChevronRight className="h-3.5 w-3.5 opacity-75" />
                            )}
                            {isReferralReq && refReqCount > 0 && (
                              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950 shadow-[0_0_18px_rgba(252,211,77,0.45)]">
                                {refReqCount > 99 ? "99+" : refReqCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>
        </header>

        {/* Mobile top identity bar */}
        <header
          className={[
            "admin-mobile-topbar fixed left-0 right-0 top-0 z-50 border-b border-white/8 bg-[#07111f]/82 px-3 backdrop-blur-2xl transition-all duration-300 md:hidden",
            condensed ? "pb-2" : "pb-3",
          ].join(" ")}
        >
          <div className="relative flex min-h-[60px] items-center justify-between gap-3 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] px-4 shadow-[0_18px_50px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(220px_90px_at_0%_0%,rgba(125,211,252,0.15),transparent_68%)]" />
            <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(180px_80px_at_100%_0%,rgba(99,102,241,0.14),transparent_70%)]" />

            <div className="relative z-10 flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-300/18 bg-white/[0.07] shadow-[0_12px_28px_rgba(34,211,238,0.10)]">
                <PanelsTopLeft className="h-5 w-5 text-cyan-100" />
              </div>

              <div className="min-w-0">
                <div className="truncate text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">
                  Admin Control
                </div>
                <div className="truncate text-sm font-semibold text-white/92">
                  {state.name}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="admin-mobile-icon-button relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-red-300/22 bg-red-300/10 text-red-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main
          key={pathname}
          className="relative z-10 isolate min-h-[calc(100svh-80px)] overflow-visible pb-[calc(env(safe-area-inset-bottom)+158px)] md:pb-12"
        >
          <motion.div
            key={pathname}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-0 isolate min-h-[calc(100svh-80px)]"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom tabs + expanding subtabs */}
      <nav className="admin-mobile-dock fixed inset-x-0 bottom-0 z-50 px-3 md:hidden">
        <div className="mx-auto max-w-[520px]">
          <AnimatePresence initial={false}>
            {activeGroup.items && activeGroup.items.length > 0 && (
              <motion.div
                key={activeGroup.label}
                initial={
                  prefersReducedMotion
                    ? false
                    : { opacity: 0, y: 12, height: 0 }
                }
                animate={
                  prefersReducedMotion
                    ? {}
                    : { opacity: 1, y: 0, height: "auto" }
                }
                exit={
                  prefersReducedMotion
                    ? {}
                    : { opacity: 0, y: 12, height: 0 }
                }
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="mb-2 overflow-hidden"
              >
                <div className="rounded-[24px] border border-cyan-300/14 bg-[#081625]/94 p-2 shadow-[0_-10px_35px_rgba(34,211,238,0.10),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl">
                  <div className="mb-2 flex items-center justify-between px-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/55">
                      {activeGroup.label}
                    </div>
                    <div className="text-[10px] text-white/35">More tabs</div>
                  </div>

                  <div
                    className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {activeGroup.items.map((item) => {
                      const active = pathStartsWith(pathname, item.href);
                      const Icon = item.icon;
                      const isReferralReq =
                        item.href === "/admin/portal/referral-requests";

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={[
                            "admin-mobile-subtab relative inline-flex min-w-max items-center gap-2 rounded-2xl border px-3 py-2 text-[11px] font-medium transition",
                            active
                              ? "border-cyan-300/34 bg-cyan-300/14 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                              : "border-white/10 bg-white/[0.045] text-white/68 hover:border-cyan-300/18 hover:bg-white/[0.07] hover:text-white",
                          ].join(" ")}
                        >
                          {active && (
                            <motion.span
                              layoutId="admin-mobile-subtab-active-glow"
                              className="absolute inset-0 rounded-2xl bg-[radial-gradient(90px_42px_at_50%_0%,rgba(125,211,252,0.24),transparent_75%)]"
                            />
                          )}

                          <Icon className="relative z-10 h-3.5 w-3.5" />
                          <span className="relative z-10">{item.label}</span>

                          {isReferralReq && refReqCount > 0 && (
                            <span className="relative z-10 inline-flex min-w-[18px] items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950">
                              {refReqCount > 99 ? "99+" : refReqCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="rounded-[28px] border border-white/10 bg-[#07111f]/92 p-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-[0_-18px_55px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
            <div className="grid grid-cols-5 gap-1">
              {ADMIN_NAV.map((group) => {
                const active = isGroupActive(pathname, group);
                const Icon = group.icon;

                return (
                  <Link
                    key={group.label}
                    href={group.primaryHref}
                    className={[
                      "admin-mobile-tab relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-[10px] transition",
                      active
                        ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                        : "border-transparent text-white/52 hover:bg-white/[0.055] hover:text-white",
                    ].join(" ")}
                  >
                    {active && (
                      <motion.span
                        layoutId="admin-mobile-active-glow"
                        className="absolute inset-0 rounded-2xl bg-[radial-gradient(80px_40px_at_50%_0%,rgba(125,211,252,0.22),transparent_75%)]"
                      />
                    )}

                    <span className="relative z-10">
                      <Icon className="h-4 w-4" />
                      {group.label === "Customers" && refReqCount > 0 && (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                      )}
                    </span>

                    <span className="relative z-10 max-w-full truncate">
                      {shortMobileLabel(group.label)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      <style jsx global>{`
        html,
        body {
          min-height: 100%;
          background: #040812;
        }

        @supports (height: 100dvh) {
          .admin-mobile-fullscreen {
            min-height: 100dvh;
          }
        }

        .admin-mobile-topbar {
          padding-top: env(safe-area-inset-top);
        }

        .admin-mobile-dock {
          padding-bottom: max(env(safe-area-inset-bottom), 8px);
        }

        .admin-nav-primary,
        .admin-nav-secondary,
        .admin-logout-pill,
        .admin-side-link,
        .admin-mobile-tab,
        .admin-mobile-subtab,
        .admin-mobile-icon-button {
          position: relative;
          overflow: hidden;
          transform-origin: center;
          will-change: transform, box-shadow;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .admin-nav-primary::before,
        .admin-nav-secondary::before,
        .admin-logout-pill::before,
        .admin-side-link::before,
        .admin-mobile-tab::before,
        .admin-mobile-subtab::before,
        .admin-mobile-icon-button::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: radial-gradient(
            circle at 12% 0%,
            rgba(255, 255, 255, 0.24),
            transparent 56%
          );
          opacity: 0;
          transform: scale(0.68);
          transition:
            opacity 220ms ease,
            transform 260ms ease;
          pointer-events: none;
        }

        .admin-nav-primary:hover,
        .admin-nav-secondary:hover,
        .admin-logout-pill:hover,
        .admin-side-link:hover,
        .admin-mobile-tab:hover,
        .admin-mobile-subtab:hover,
        .admin-mobile-icon-button:hover {
          transform: translateY(-1px) scale(1.02);
        }

        .admin-mobile-tab:active,
        .admin-mobile-subtab:active,
        .admin-mobile-icon-button:active {
          transform: scale(0.96);
        }

        .admin-nav-primary:hover {
          box-shadow:
            0 0 0 1px rgba(34, 211, 238, 0.22),
            0 16px 34px rgba(2, 8, 23, 0.46),
            0 0 28px rgba(56, 189, 248, 0.18);
        }

        .admin-nav-secondary:hover {
          box-shadow:
            0 0 0 1px rgba(34, 211, 238, 0.2),
            0 14px 28px rgba(2, 8, 23, 0.38),
            0 0 22px rgba(56, 189, 248, 0.16);
        }

        .admin-logout-pill:hover,
        .admin-mobile-icon-button:hover {
          box-shadow:
            0 0 0 1px rgba(248, 113, 113, 0.24),
            0 14px 30px rgba(2, 8, 23, 0.44),
            0 0 22px rgba(248, 113, 113, 0.18);
        }

        .admin-nav-primary:hover::before,
        .admin-nav-secondary:hover::before,
        .admin-logout-pill:hover::before,
        .admin-side-link:hover::before,
        .admin-mobile-tab:hover::before,
        .admin-mobile-subtab:hover::before,
        .admin-mobile-icon-button:hover::before {
          opacity: 1;
          transform: scale(1);
        }

        .admin-nav-primary::after,
        .admin-nav-secondary::after,
        .admin-mobile-tab::after,
        .admin-mobile-subtab::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          border: 1px solid rgba(125, 211, 252, 0.7);
          transform: translate(-50%, -50%) scale(0.15);
          opacity: 0;
          pointer-events: none;
        }

        .admin-nav-primary:hover::after,
        .admin-nav-secondary:hover::after,
        .admin-mobile-tab:active::after,
        .admin-mobile-subtab:active::after {
          animation: admin-nav-ripple 650ms ease-out forwards;
        }

        @keyframes admin-nav-ripple {
          0% {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(0.15);
          }
          60% {
            opacity: 0.28;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.38);
          }
        }

        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 767px) {
          body {
            overscroll-behavior-y: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </div>
  );
}