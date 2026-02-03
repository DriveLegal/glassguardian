// app/admin/(protected)/layout.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";

type AnyObj = Record<string, any>;

async function isAdminByTable(email: string): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await supabaseClient
    .from("admins")
    .select("role, is_active")
    .eq("email", email)
    .maybeSingle();
  if (error) return false;
  return !!data && data.is_active === true && (data.role === "admin" || data.role === "support");
}

function resolveRole(
  u: { app_metadata?: AnyObj; user_metadata?: AnyObj } | null | undefined
): string | null {
  if (!u) return null;
  const r = (u.app_metadata?.role ?? u.user_metadata?.role ?? null) as string | null;
  return typeof r === "string" ? r : null;
}

/* -------------------- Nav config -------------------- */

type NavItem = { label: string; href: string };
type NavGroup = { label: string; primaryHref: string; items?: NavItem[] };

const ADMIN_NAV: NavGroup[] = [
  {
    label: "Portal",
    primaryHref: "/admin/portal",
  },
  {
    label: "Operations",
    primaryHref: "/admin/portal/appointments",
    items: [
      { label: "Appointments", href: "/admin/portal/appointments" },
      { label: "Calendar", href: "/admin/portal/calendar" },
      { label: "Claims", href: "/admin/portal/claims" },
      { label: "Booking leads", href: "/admin/portal/bookingleads" },
    ],
  },
  {
    label: "Customers",
    primaryHref: "/admin/portal/customers",
    items: [
      { label: "Customers", href: "/admin/portal/customers" },
      { label: "Warranties", href: "/admin/portal/warranties" },
      { label: "Messages", href: "/admin/portal/messages" },
      { label: "Notifications", href: "/admin/portal/notifications" },
    ],
  },
  {
    label: "Billing & Analytics",
    primaryHref: "/admin/portal/invoices",
    items: [
      { label: "Invoices", href: "/admin/portal/invoices" },
      { label: "Pricing", href: "/admin/portal/pricing" },
      { label: "Analytics", href: "/admin/portal/analytics" },
    ],
  },
  {
    label: "Team & Support",
    primaryHref: "/admin/portal/technicians",
    items: [
      { label: "Technicians", href: "/admin/portal/technicians" },
      { label: "Support", href: "/admin/portal/support" },
    ],
  },
];

function pathStartsWith(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = React.useState({
    ready: false,
    allowed: false,
    name: "Admin",
  });

  const [condensed, setCondensed] = React.useState(false);

  /* -------------------- Auth Gate -------------------- */

  React.useEffect(() => {
    let mounted = true;
    let redirected = false;

    const allow = (name: string) =>
      mounted && setState({ ready: true, allowed: true, name });

    const block = () => {
      if (!mounted || redirected) return;
      redirected = true;
      setState({ ready: true, allowed: false, name: "Admin" });
      router.replace(
        `/admin/login?redirect=${encodeURIComponent(pathname || "/admin/portal")}`
      );
    };

    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      const user = session?.user ?? null;
      const email = user?.email ?? null;

      const metaRole = resolveRole(user);

      if (user && (metaRole === "admin" || metaRole === "support")) {
        const displayName =
          (user?.user_metadata as AnyObj)?.full_name ||
          email?.split("@")[0] ||
          "Admin";
        allow(displayName);
        return;
      }

      if (user && email) {
        const ok = await isAdminByTable(email);
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

      const { data: sub } = supabaseClient.auth.onAuthStateChange(
        async (_evt, sess) => {
          if (!mounted || redirected) return;

          const u = sess?.user ?? null;
          const e = u?.email ?? null;
          const r = resolveRole(u);

          if (u && (r === "admin" || r === "support")) {
            const displayName =
              (u.user_metadata as AnyObj)?.full_name ||
              e?.split("@")[0] ||
              "Admin";
            allow(displayName);
            return;
          }

          if (u && e) {
            const ok = await isAdminByTable(e);
            if (ok) {
              const displayName =
                (u.user_metadata as AnyObj)?.full_name ||
                e.split("@")[0] ||
                "Admin";
              allow(displayName);
              return;
            }
          }

          block();
        }
      );

      return () => {
        mounted = false;
        sub?.subscription?.unsubscribe();
      };
    })();

    return () => {
      mounted = false;
    };
  }, [router, pathname]);

  /* -------------------- Shrink Header on Scroll -------------------- */

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

  if (!state.ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-100">
        <div className="animate-pulse text-sm opacity-80">Checking admin access…</div>
      </div>
    );
  }

  if (!state.allowed) return null;

  /* -------------------- Active Group -------------------- */

  const activeGroup: NavGroup =
    ADMIN_NAV.find((group) => {
      if (group.items && group.items.length > 0) {
        return group.items.some((item) => pathStartsWith(pathname, item.href));
      }
      return pathname === group.primaryHref;
    }) ?? ADMIN_NAV[0];

  /* -------------------- Logout -------------------- */

  async function handleLogout() {
    await supabaseClient.auth.signOut();
    router.replace("/admin/login");
  }

  /* -------------------- UI -------------------- */

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-visible">
      {/* Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 15% 0%, rgba(56,189,248,0.22), transparent 45%), radial-gradient(800px 500px at 85% 100%, rgba(129,140,248,0.22), transparent 45%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,1))",
          }}
        />
      </div>

      {/* Header */}
      <header
        className={[
          "sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl transition-all duration-200",
          condensed ? "py-1" : "py-2",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex max-w-7xl items-center justify-between px-4 md:px-8 transition-all duration-200",
            condensed ? "gap-3" : "gap-4",
          ].join(" ")}
        >
          {/* Left */}
          <div className="flex items-center gap-3">
            <div
              className={[
                "rounded-xl bg-gradient-to-br from-cyan-400 to-sky-500 shadow-lg shadow-cyan-500/40 transition-all duration-200",
                condensed ? "h-7 w-7" : "h-8 w-8",
              ].join(" ")}
            />
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                Glass Guardian • Admin
              </div>
              <div className="text-xs md:text-sm font-semibold text-slate-100">
                Portal access for{" "}
                <span className="text-cyan-300">{state.name}</span>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
              Live Ops
            </span>
            <button
              onClick={handleLogout}
              className="transform rounded-full border border-red-400/40 bg-red-400/10 px-3 py-1 text-[11px] text-red-200 hover:bg-red-500/20 transition-all duration-150 admin-logout-pill"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="border-t border-white/5 bg-slate-950/80">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            {/* Primary Tabs */}
            <div
              className={[
                // negative horizontal margin + extra padding so pills never clip on mobile
                "flex gap-2 overflow-x-auto scrollbar-none transition-all duration-200 -mx-4 px-4 pr-6",
                condensed ? "py-1.5" : "py-2.5",
              ].join(" ")}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {ADMIN_NAV.map((group) => {
                const isGroupActive =
                  group.label === "Portal"
                    ? pathname === group.primaryHref
                    : (group.items ?? []).some((item) =>
                        pathStartsWith(pathname, item.href)
                      );

                return (
                  <Link
                    key={group.label}
                    href={group.primaryHref}
                    className={[
                      "transform whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs md:text-sm border transition-all duration-200 admin-nav-primary",
                      isGroupActive
                        ? "bg-sky-500/15 border-sky-400/70 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]"
                        : "bg-slate-900/60 border-slate-600/60 text-slate-300",
                    ].join(" ")}
                  >
                    {group.label}
                  </Link>
                );
              })}
            </div>

            {/* Secondary Pills */}
            <div className="flex flex-col gap-1 pb-3">
              {activeGroup.items && activeGroup.items.length > 0 && (
                <div
                  className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pr-6"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {activeGroup.items.map((item) => {
                    const active = pathStartsWith(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "transform whitespace-nowrap rounded-full px-3 py-1 text-[11px] md:text-xs border transition-all duration-200 admin-nav-secondary",
                          active
                            ? "bg-sky-500/30 border-sky-400/80 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.5)]"
                            : "bg-slate-900/70 border-slate-600/60 text-slate-300",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 md:px-8">
        {children}
      </main>

      {/* Hover FX for nav pills */}
      <style jsx global>{`
        .admin-nav-primary,
        .admin-nav-secondary,
        .admin-logout-pill {
          position: relative;
          overflow: hidden;
          transform-origin: center;
        }

        .admin-nav-primary::before,
        .admin-nav-secondary::before,
        .admin-logout-pill::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: radial-gradient(
            circle at 10% 0%,
            rgba(248, 250, 252, 0.35),
            transparent 55%
          );
          opacity: 0;
          transform: scale(0.6);
          transition: opacity 220ms ease, transform 260ms ease;
          pointer-events: none;
        }

        .admin-nav-primary:hover,
        .admin-nav-secondary:hover,
        .admin-logout-pill:hover {
          transform: translateY(-1px) scale(1.04) rotate3d(1, 0, 0, 0.5deg);
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, 0.25),
            0 12px 28px rgba(15, 23, 42, 0.85),
            0 0 30px rgba(56, 189, 248, 0.55);
        }

        .admin-nav-secondary:hover {
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, 0.28),
            0 10px 24px rgba(15, 23, 42, 0.8),
            0 0 26px rgba(56, 189, 248, 0.55);
        }

        .admin-logout-pill:hover {
          box-shadow:
            0 0 0 1px rgba(248, 113, 113, 0.4),
            0 10px 24px rgba(15, 23, 42, 0.9),
            0 0 30px rgba(248, 113, 113, 0.65);
        }

        .admin-nav-primary:hover::before,
        .admin-nav-secondary:hover::before,
        .admin-logout-pill:hover::before {
          opacity: 1;
          transform: scale(1);
        }

        .admin-nav-primary::after,
        .admin-nav-secondary::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 1px solid rgba(125, 211, 252, 0.8);
          transform: translate(-50%, -50%) scale(0.1);
          opacity: 0;
          pointer-events: none;
        }

        .admin-nav-primary:hover::after,
        .admin-nav-secondary:hover::after {
          animation: admin-nav-ripple 650ms ease-out forwards;
        }

        @keyframes admin-nav-ripple {
          0% {
            opacity: 0.55;
            transform: translate(-50%, -50%) scale(0.1);
          }
          60% {
            opacity: 0.35;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.4);
          }
        }
      `}</style>
    </div>
  );
}