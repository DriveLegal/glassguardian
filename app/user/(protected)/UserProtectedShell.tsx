// app/user/(protected)/UserProtectedShell.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Car,
  CalendarClock,
  Settings,
  Gift,
  ReceiptText,
  Shield,
  X,
  Send,
  Loader2,
  Sparkles,
  Search,
  Inbox,
  Plus,
  ChevronLeft,
  ChevronRight,
  Circle,
  Menu,
  Activity,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UserLayoutTopDiamond from "@/components/user/dashboard/layout/TopDiamond";
import SecurityRail from "@/components/user/security/SecurityRail";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
    } else if (typeof (mql as any).addListener === "function") {
      (mql as any).addListener(handler);
    }

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handler);
      } else if (typeof (mql as any).removeListener === "function") {
        (mql as any).removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}

function useIsDesktop() {
  const wide = useMediaQuery("(min-width: 1024px)");
  const fine = useMediaQuery("(pointer: fine)");
  return wide && fine;
}

function useIsLandscape() {
  return useMediaQuery("(orientation: landscape)");
}

function useIsTouchDevice() {
  return useMediaQuery("(pointer: coarse)");
}

function cleanName(s?: string | null) {
  const v = (s ?? "").trim();
  if (!v) return null;
  const collapsed = v.replace(/\s+/g, " ");
  return collapsed.length > 0 ? collapsed : null;
}

function buildNameFromMetadata(meta: any): string | null {
  if (!meta) return null;

  const full =
    cleanName(meta.full_name) ||
    cleanName(meta.name) ||
    cleanName([meta.first_name, meta.last_name].filter(Boolean).join(" ") || null);

  return full ?? null;
}

type NavTab = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type AppointmentLite = {
  id: string;
  status: string | null;
};

type SupportMessageRow = {
  id: string;
  subject: string | null;
  body: string;
  appointment_id: string | null;
  sender_email: string;
  sender_role: "customer" | "support" | "admin" | string | null;
  recipient_email: string | null;
  message_type: "support" | "appointment" | string | null;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string | null;
};

type SupportThread = {
  id: string;
  key: string;
  subject: string | null;
  appointment_id: string | null;
  customer_email: string;
  messages: SupportMessageRow[];
  last_message_at: string | null;
  last_message_preview: string;
  unread_from_support: number;
};

const TABS: NavTab[] = [
  { href: "/user/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/user/dashboard/appointments", label: "Appointments", shortLabel: "Appts", icon: CalendarClock },
  { href: "/user/dashboard/garage", label: "Garage", shortLabel: "Garage", icon: Car },
  { href: "/user/dashboard/pay", label: "Invoices", shortLabel: "Bills", icon: ReceiptText },
  { href: "/user/dashboard/warranties", label: "Warranties", shortLabel: "Cover", icon: Shield },
  { href: "/user/dashboard/referrals", label: "Referrals", shortLabel: "Perks", icon: Gift },
  { href: "/user/dashboard/settings", label: "Settings", shortLabel: "Setup", icon: Settings },
];

function isActiveTab(pathname: string, href: string) {
  const p = pathname.replace(/\/+$/, "");
  const h = href.replace(/\/+$/, "");

  if (h === "/user/dashboard") {
    return p === "/user/dashboard" || p === "/user";
  }

  return p === h || p.startsWith(h + "/");
}

function getActiveTab(pathname: string) {
  return TABS.find((tab) => isActiveTab(pathname, tab.href)) ?? TABS[0];
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
        opacity: [0.34, 0.58, 0.4],
        scale: [0.96, 1.06, 0.98],
        x: [0, 10, -7, 0],
        y: [0, -9, 7, 0],
      }}
      transition={{
        duration: 13,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

function RadiantBackdrop({ reduced = false }: { reduced?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1000px_620px_at_10%_0%,rgba(56,189,248,0.13),transparent_46%),radial-gradient(820px_560px_at_92%_100%,rgba(16,185,129,0.13),transparent_44%),radial-gradient(740px_460px_at_50%_18%,rgba(99,102,241,0.10),transparent_55%),linear-gradient(180deg,#050914_0%,#07111d_46%,#040812_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:38px_38px] opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_55%,rgba(0,0,0,0.34)_100%)]" />

      <AmbientGlow
        reduced={reduced}
        className="absolute left-[-10%] top-[3%] h-[20rem] w-[20rem] rounded-full bg-sky-400/12 blur-3xl"
      />
      <AmbientGlow
        reduced={reduced}
        delay={0.8}
        className="absolute right-[-6%] top-[8%] h-[18rem] w-[18rem] rounded-full bg-emerald-400/12 blur-3xl"
      />
      <AmbientGlow
        reduced={reduced}
        delay={1.6}
        className="absolute bottom-[-8%] left-[22%] h-[16rem] w-[16rem] rounded-full bg-indigo-500/12 blur-3xl"
      />
    </div>
  );
}

function safeDate(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanPreview(body: string, max = 140) {
  const clean = String(body ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

function getThreadSubjectFromMessage(m: SupportMessageRow) {
  const s = String(m.subject ?? "").trim();
  if (!s) return "Support request";
  return s.replace(/^re:\s*/i, "").trim() || "Support request";
}

function getThreadKeyForUser(m: SupportMessageRow, userEmail: string) {
  const appointment = m.appointment_id ?? "no-appointment";
  const subject = getThreadSubjectFromMessage(m).toLowerCase();
  return `${normalizeText(userEmail)}__${appointment}__${subject}`;
}

function buildSupportThreads(messages: SupportMessageRow[], userEmail: string): SupportThread[] {
  const map = new Map<string, SupportMessageRow[]>();

  for (const m of messages) {
    const key = getThreadKeyForUser(m, userEmail);
    const existing = map.get(key) ?? [];
    existing.push(m);
    map.set(key, existing);
  }

  const threads = Array.from(map.entries()).map(([key, rows]) => {
    const chronological = [...rows].sort(
      (a, b) => safeDate(a.created_at).getTime() - safeDate(b.created_at).getTime()
    );

    const latest = chronological[chronological.length - 1];

    return {
      id: key,
      key,
      subject: getThreadSubjectFromMessage(latest),
      appointment_id: latest.appointment_id ?? null,
      customer_email: userEmail,
      messages: chronological,
      last_message_at: latest.created_at ?? null,
      last_message_preview: cleanPreview(latest.body, 150),
      unread_from_support: rows.filter(
        (m) =>
          (normalizeText(m.sender_role) === "admin" || normalizeText(m.sender_role) === "support") &&
          !m.is_read
      ).length,
    };
  });

  return threads.sort(
    (a, b) => safeDate(b.last_message_at).getTime() - safeDate(a.last_message_at).getTime()
  );
}

function isSupportSideMessage(m: SupportMessageRow) {
  const role = normalizeText(m.sender_role);
  return role === "admin" || role === "support";
}

function FloatingSupportBubble({
  open,
  setOpen,
  isDesktop,
  isLandscape,
  isTouchLandscape,
  userEmail,
  userName,
  appointments,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDesktop: boolean;
  isLandscape: boolean;
  isTouchLandscape: boolean;
  userEmail: string | null;
  userName: string | null;
  appointments: AppointmentLite[];
}) {
  const prefersReducedMotion = useReducedMotion();

  const [mode, setMode] = React.useState<"threads" | "new">("threads");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string>("");
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const didAutoOpenRef = React.useRef(false);
  const wasOpenRef = React.useRef(false);

  const {
    data: supportMessages = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["user:support:messages", userEmail],
    enabled: !!userEmail && open,
    queryFn: async () => {
      if (!userEmail) return [];

      const { data, error } = await supabaseClient
        .from("messages")
        .select(
          [
            "id",
            "subject",
            "body",
            "appointment_id",
            "sender_email",
            "sender_role",
            "recipient_email",
            "message_type",
            "is_read",
            "read_at",
            "created_at",
          ].join(",")
        )
        .eq("message_type", "support")
        .or(`sender_email.eq.${userEmail},recipient_email.eq.${userEmail}`)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      return (data ?? []) as unknown as SupportMessageRow[];
    },
    staleTime: 6_000,
    refetchOnWindowFocus: true,
  });

  const threads = React.useMemo(() => {
    if (!userEmail) return [];
    return buildSupportThreads(supportMessages, userEmail);
  }, [supportMessages, userEmail]);

  const filteredThreads = React.useMemo(() => {
    const q = normalizeText(search);
    if (!q) return threads;

    return threads.filter((t) => {
      const haystack = [
        t.subject,
        t.last_message_preview,
        t.appointment_id,
        ...t.messages.map((m) => `${m.body} ${m.sender_email}`),
      ]
        .map((v) => normalizeText(v))
        .join(" ");

      return haystack.includes(q);
    });
  }, [threads, search]);

  const selectedThread = React.useMemo(() => {
    if (!selectedThreadId) return null;
    return (
      filteredThreads.find((t) => t.id === selectedThreadId) ??
      threads.find((t) => t.id === selectedThreadId) ??
      null
    );
  }, [filteredThreads, threads, selectedThreadId]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
  }, [open]);

  React.useEffect(() => {
    if (appointments.length > 0 && !selectedAppointmentId) {
      setSelectedAppointmentId(appointments[0]?.id ?? "");
    }
  }, [appointments, selectedAppointmentId]);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      didAutoOpenRef.current = false;
      setMode("threads");
    }

    if (!open) {
      didAutoOpenRef.current = false;
      setSelectedThreadId(null);
    }

    wasOpenRef.current = open;
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (didAutoOpenRef.current) return;
    if (threads.length === 0) return;

    setSelectedThreadId(threads[0].id);
    didAutoOpenRef.current = true;
  }, [open, threads]);

  React.useEffect(() => {
    if (!open) return;

    const ch = supabaseClient
      .channel(`user-support-messages-${userEmail ?? "anon"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(ch);
    };
  }, [open, refetch, userEmail]);

  async function sendNewRequest() {
    if (isSending) return;

    const cleanBody = body.trim();
    if (!cleanBody || !userEmail) return;

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabaseClient.from("messages").insert({
        subject: subject.trim() || "Customer support request",
        body: cleanBody,
        appointment_id: selectedAppointmentId || null,
        sender_email: userEmail,
        sender_role: "customer",
        recipient_email: "info@glassguardianchipandcrackrepair.com",
        message_type: "support",
        is_read: false,
      });

      if (error) throw error;

      setBody("");
      setSubject("");
      setSuccess("Your message was sent.");
      setMode("threads");
      await refetch();
    } catch (err: any) {
      setError(err?.message || "Failed to send.");
    } finally {
      setIsSending(false);
    }
  }

  async function sendThreadReply() {
    if (isSending) return;
    if (!selectedThread || !replyText.trim() || !userEmail) return;

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabaseClient.from("messages").insert({
        subject: `Re: ${selectedThread.subject || "Support request"}`,
        body: replyText.trim(),
        appointment_id: selectedThread.appointment_id,
        sender_email: userEmail,
        sender_role: "customer",
        recipient_email: "info@glassguardianchipandcrackrepair.com",
        message_type: "support",
        is_read: false,
      });

      if (error) throw error;

      setReplyText("");
      await refetch();
    } catch (err: any) {
      setError(err?.message || "Failed to send.");
    } finally {
      setIsSending(false);
    }
  }

  const bubblePositionClass = isDesktop
    ? "bottom-6 right-6"
    : isTouchLandscape
      ? "bottom-4 left-4"
      : isLandscape
        ? "bottom-4 right-4"
        : "bottom-[calc(env(safe-area-inset-bottom)+7.85rem)] right-3";

  const panelClass = isDesktop
    ? "bottom-6 right-6 w-[28rem] h-[46rem]"
    : isTouchLandscape
      ? "left-4 right-[6.9rem] top-[calc(env(safe-area-inset-top)+4.65rem)] bottom-4"
      : isLandscape
        ? "bottom-4 right-4 left-4 h-[82dvh]"
        : "right-3 left-3 bottom-4 h-[82dvh]";

  return (
    <>
      <div className={`fixed z-[70] ${bubblePositionClass}`}>
        <AnimatePresence>
          {!open && (
            <motion.button
              key="support-bubble"
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open support center"
              aria-controls="support-center"
              aria-expanded={open}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.75, y: 18, rotate: -6 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 14, rotate: 4 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 }
              }
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: 1.06,
                      rotate: 1,
                      boxShadow:
                        "0 0 0 1px rgba(255,255,255,0.20), 0 0 46px rgba(56,189,248,0.60), 0 24px 60px rgba(14,165,233,0.42), 0 10px 26px rgba(0,0,0,0.40)",
                    }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94, rotate: -1 }}
              className="
                user-support-bubble group relative inline-flex h-14 w-14 select-none items-center justify-center overflow-hidden rounded-full
                border border-sky-200/40
                bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_45%),linear-gradient(180deg,rgba(103,232,249,0.98),rgba(14,165,233,0.96))]
                text-slate-950
                shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_34px_rgba(56,189,248,0.46),0_18px_46px_rgba(14,165,233,0.34),0_10px_22px_rgba(0,0,0,0.38)]
                ring-1 ring-white/10
                transition-[filter] duration-200
                hover:brightness-[1.03]
                touch-manipulation
                focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                md:h-16 md:w-16
              "
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.24),transparent_48%)]"
              />

              <span
                aria-hidden="true"
                className="
                  pointer-events-none absolute left-1/2 top-1/2 h-[39px] w-[47px]
                  -translate-x-1/2 -translate-y-[48%] rounded-[999px]
                  bg-[radial-gradient(120%_120%_at_28%_18%,rgba(255,255,255,0.16),rgba(255,255,255,0)_42%),linear-gradient(180deg,#0b1220_0%,#020617_60%,#000000_100%)]
                  shadow-[0_18px_34px_rgba(0,0,0,0.55),0_8px_18px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-10px_20px_rgba(0,0,0,0.55)]
                  ring-1 ring-white/10 md:h-[44px] md:w-[52px]
                "
              />

              <span
                aria-hidden="true"
                className="
                  pointer-events-none absolute left-1/2 top-1/2 h-[14px] w-[14px]
                  -translate-x-[-9px] -translate-y-[-4px] rotate-[28deg] rounded-[5px]
                  bg-[linear-gradient(180deg,#0b1220_0%,#020617_65%,#000000_100%)]
                  shadow-[0_18px_34px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]
                  md:h-[16px] md:w-[16px]
                "
              />

              <span
                aria-hidden="true"
                className="
                  absolute left-1/2 top-1/2 flex h-[27px] w-[34px]
                  -translate-x-1/2 -translate-y-[48%] items-center justify-center rounded-full bg-white
                  text-[8px] font-black uppercase tracking-[0.12em] text-slate-950
                  shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-6px_12px_rgba(15,23,42,0.12),0_10px_18px_rgba(0,0,0,0.22)]
                  ring-1 ring-slate-950/10 md:h-[30px] md:w-[36px] md:text-[8.5px]
                "
              >
                HELP
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close support center backdrop"
              className="fixed inset-0 z-[75] bg-slate-950/65 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              id="support-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gg-support-title"
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 20, scale: 0.985 }}
              transition={{ duration: 0.22 }}
              className={[
                "fixed z-[80] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/95 text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
                panelClass,
              ].join(" ")}
            >
              <div className="relative flex h-full flex-col">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_35%)]" />

                <div className="relative border-b border-white/10 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                        <Sparkles className="h-3.5 w-3.5" />
                        Glass Guardian Support
                      </div>
                      <h2 id="gg-support-title" className="text-lg font-semibold text-white">
                        Support Center
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        View past requests or send a new one.
                        {userName ? ` We’ve got you, ${userName}.` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close support center"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("threads");
                        setSelectedThreadId(null);
                      }}
                      className={[
                        "rounded-full border px-3 py-2 text-sm font-medium transition",
                        mode === "threads"
                          ? "border-sky-300/25 bg-sky-400/15 text-sky-100"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                      ].join(" ")}
                    >
                      Support inbox
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("new")}
                      className={[
                        "rounded-full border px-3 py-2 text-sm font-medium transition",
                        mode === "new"
                          ? "border-sky-300/25 bg-sky-400/15 text-sky-100"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                      ].join(" ")}
                    >
                      New request
                    </button>
                  </div>
                </div>

                <div className="relative flex-1 overflow-hidden">
                  {mode === "threads" ? (
                    <div className="flex h-full flex-col">
                      {selectedThread ? (
                        <>
                          <div className="border-b border-white/10 px-4 py-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedThreadId(null)}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Back
                              </button>

                              <Badge className="border border-white/10 bg-white/5 text-white/70">
                                {selectedThread.messages.length} msg
                                {selectedThread.messages.length === 1 ? "" : "s"}
                              </Badge>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-white">
                                {selectedThread.subject || "Support request"}
                              </p>
                              <p className="mt-1 text-xs text-white/50">
                                {selectedThread.appointment_id
                                  ? `Appointment: ${selectedThread.appointment_id}`
                                  : "General support"}
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto px-4 py-4">
                            <div className="space-y-4">
                              {selectedThread.messages.map((message, idx) => {
                                const mine = !isSupportSideMessage(message);
                                const prev = selectedThread.messages[idx - 1];
                                const showTimeDivider =
                                  idx === 0 ||
                                  safeDate(message.created_at).getTime() -
                                    safeDate(prev?.created_at).getTime() >
                                    1000 * 60 * 30;

                                return (
                                  <React.Fragment key={message.id}>
                                    {showTimeDivider && (
                                      <div className="flex justify-center py-2">
                                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/50">
                                          {format(safeDate(message.created_at), "MMM d • h:mm a")}
                                        </div>
                                      </div>
                                    )}

                                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                                      <div
                                        className={`max-w-[84%] ${
                                          mine ? "items-end" : "items-start"
                                        } flex flex-col`}
                                      >
                                        <div className="mb-1 px-2 text-[11px] text-white/45">
                                          {mine ? "You" : "Glass Guardian"}
                                        </div>

                                        <div
                                          className={[
                                            "rounded-[24px] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]",
                                            mine
                                              ? "rounded-br-md border border-sky-300/20 bg-[linear-gradient(180deg,rgba(56,189,248,0.98),rgba(14,165,233,0.94))] text-slate-950"
                                              : "rounded-bl-md border border-white/10 bg-white/[0.08] text-white",
                                          ].join(" ")}
                                        >
                                          <p className="whitespace-pre-wrap text-sm leading-6">
                                            {message.body}
                                          </p>
                                        </div>

                                        <div
                                          className={`mt-1 flex items-center gap-1 px-2 text-[11px] text-white/35 ${
                                            mine ? "justify-end" : "justify-start"
                                          }`}
                                        >
                                          {!mine && !message.is_read ? (
                                            <Circle className="h-2.5 w-2.5 fill-sky-300 text-sky-300" />
                                          ) : null}
                                          <span>{format(safeDate(message.created_at), "h:mm a")}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-t border-white/10 px-4 py-4">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Reply in this support thread..."
                              rows={4}
                              className="mb-3 resize-none border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                            />

                            {error ? (
                              <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                                {error}
                              </div>
                            ) : null}

                            {success ? (
                              <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                                {success}
                              </div>
                            ) : null}

                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setReplyText("")}
                                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                              >
                                Clear
                              </Button>

                              <Button
                                type="button"
                                onClick={sendThreadReply}
                                disabled={isSending || !replyText.trim() || !userEmail}
                                className="border border-sky-300/20 bg-sky-500 text-slate-950 hover:bg-sky-400"
                              >
                                {isSending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="border-b border-white/10 px-4 py-3">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                              <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search support requests..."
                                className="border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-slate-500"
                              />
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto px-4 py-4">
                            {isLoading ? (
                              <div className="flex h-full items-center justify-center">
                                <div className="text-center">
                                  <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-sky-300" />
                                  <p className="text-sm text-white/65">Loading support history...</p>
                                </div>
                              </div>
                            ) : filteredThreads.length === 0 ? (
                              <div className="flex h-full items-center justify-center">
                                <div className="max-w-sm text-center">
                                  <Inbox className="mx-auto mb-4 h-12 w-12 text-white/30" />
                                  <h3 className="text-lg font-semibold text-white">
                                    No support requests yet
                                  </h3>
                                  <p className="mt-2 text-sm text-white/60">
                                    Start a new request and it’ll appear here.
                                  </p>
                                  <Button
                                    type="button"
                                    onClick={() => setMode("new")}
                                    className="mt-4 border border-sky-300/20 bg-sky-500 text-slate-950 hover:bg-sky-400"
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    New request
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {filteredThreads.map((thread) => {
                                  const unread = thread.unread_from_support > 0;

                                  return (
                                    <button
                                      key={thread.id}
                                      type="button"
                                      onClick={() => setSelectedThreadId(thread.id)}
                                      className={[
                                        "w-full rounded-2xl border text-left transition-all duration-200",
                                        "shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
                                        "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
                                      ].join(" ")}
                                    >
                                      <div className="p-4">
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-white">
                                              {thread.subject || "Support request"}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-white/55">
                                              {format(safeDate(thread.last_message_at), "MMM d, h:mm a")}
                                            </p>
                                          </div>

                                          <div className="flex shrink-0 items-center gap-2">
                                            {unread ? (
                                              <span className="inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-sky-400 px-2 py-1 text-[10px] font-bold text-slate-950">
                                                {thread.unread_from_support}
                                              </span>
                                            ) : (
                                              <Badge className="border border-white/10 bg-white/5 text-white/60">
                                                View
                                              </Badge>
                                            )}
                                          </div>
                                        </div>

                                        <p className="mb-3 line-clamp-3 text-sm leading-6 text-white/70">
                                          {thread.last_message_preview}
                                        </p>

                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                                          <span>
                                            {thread.messages.length} msg
                                            {thread.messages.length === 1 ? "" : "s"}
                                          </span>
                                          {thread.appointment_id ? (
                                            <Badge className="border border-white/10 bg-white/5 text-white/70">
                                              Appt linked
                                            </Badge>
                                          ) : null}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto px-5 py-5">
                      <div className="grid gap-4">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            From
                          </label>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                            {userEmail || "Loading account…"}
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="support-subject"
                            className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                          >
                            Subject
                          </label>
                          <Input
                            id="support-subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Ex: Question about my repair, invoice, warranty..."
                            className="border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="support-appointment"
                            className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                          >
                            Related appointment
                          </label>
                          <select
                            id="support-appointment"
                            value={selectedAppointmentId}
                            onChange={(e) => setSelectedAppointmentId(e.target.value)}
                            className="flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-sky-400/40"
                          >
                            <option value="" className="bg-slate-950 text-white">
                              No appointment selected
                            </option>
                            {appointments.map((apt) => (
                              <option key={apt.id} value={apt.id} className="bg-slate-950 text-white">
                                {apt.id} {apt.status ? `• ${apt.status}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="support-body"
                            className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                          >
                            Message
                          </label>
                          <Textarea
                            id="support-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Tell us what’s going on and we’ll help you out."
                            rows={8}
                            className="resize-none border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500"
                          />
                        </div>
                      </div>

                      {error ? (
                        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                          {error}
                        </div>
                      ) : null}

                      {success ? (
                        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                          {success}
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-slate-400">
                          Your request will appear in your support inbox and in the admin support desk.
                        </p>

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setBody("");
                              setSubject("");
                              setError(null);
                              setSuccess(null);
                            }}
                            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          >
                            Clear
                          </Button>

                          <Button
                            type="button"
                            onClick={sendNewRequest}
                            disabled={isSending || !body.trim() || !userEmail}
                            className="border border-sky-300/20 bg-sky-500 text-slate-950 hover:bg-sky-400"
                          >
                            {isSending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Send
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ScrollArrow({
  direction,
  visible,
  onClick,
  className = "",
}: {
  direction: "left" | "right";
  visible: boolean;
  onClick: () => void;
  className?: string;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Show previous sections" : "Show more sections"}
      onClick={onClick}
      className={[
        "user-scroll-arrow absolute top-1/2 z-20 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-sky-200/20 bg-slate-950/82 text-sky-100 shadow-[0_10px_28px_rgba(0,0,0,0.42),0_0_22px_rgba(56,189,248,0.22)] backdrop-blur-xl transition",
        direction === "left" ? "left-1" : "right-1",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function UserProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/user/dashboard";
  const prefersReducedMotion = useReducedMotion();

  const isDesktop = useIsDesktop();
  const isLandscape = useIsLandscape();
  const isTouchDevice = useIsTouchDevice();
  const isTouchLandscape = isLandscape && isTouchDevice && !isDesktop;

  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHapticFiredRef = React.useRef(false);

  const desktopNavRef = React.useRef<HTMLDivElement | null>(null);
  const mobileDockRef = React.useRef<HTMLDivElement | null>(null);

  const [desktopCanLeft, setDesktopCanLeft] = React.useState(false);
  const [desktopCanRight, setDesktopCanRight] = React.useState(false);
  const [mobileCanLeft, setMobileCanLeft] = React.useState(false);
  const [mobileCanRight, setMobileCanRight] = React.useState(false);

  const [forceDesktop, setForceDesktop] = React.useState(false);
  const [condensed, setCondensed] = React.useState(false);
  const [sidebarHovered, setSidebarHovered] = React.useState(false);

  const [hasOpenInvoice, setHasOpenInvoice] = React.useState(false);
  const [hasActiveAppointment, setHasActiveAppointment] = React.useState(false);

  const [userName, setUserName] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [customerAppointments, setCustomerAppointments] = React.useState<AppointmentLite[]>([]);
  const [supportOpen, setSupportOpen] = React.useState(false);

  const sidebarExpanded = sidebarHovered;
  const activeTab = getActiveTab(pathname);
  const ActiveIcon = activeTab.icon;

  function updateScrollState(
    el: HTMLDivElement | null,
    setLeft: React.Dispatch<React.SetStateAction<boolean>>,
    setRight: React.Dispatch<React.SetStateAction<boolean>>
  ) {
    if (!el) return;

    const isVertical = el.scrollHeight > el.clientHeight + 8 && el.scrollHeight > el.scrollWidth;
    const current = isVertical ? el.scrollTop : el.scrollLeft;
    const max = isVertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;

    setLeft(current > 6);
    setRight(current < max - 6);
  }

  function scrollTabs(el: HTMLDivElement | null, direction: "left" | "right") {
    if (!el) return;

    const isVertical = el.scrollHeight > el.clientHeight + 8 && el.scrollHeight > el.scrollWidth;

    el.scrollBy({
      left: isVertical ? 0 : direction === "left" ? -190 : 190,
      top: isVertical ? (direction === "left" ? -190 : 190) : 0,
      behavior: "smooth",
    });
  }

  React.useEffect(() => {
    const update = () => {
      updateScrollState(desktopNavRef.current, setDesktopCanLeft, setDesktopCanRight);
      updateScrollState(mobileDockRef.current, setMobileCanLeft, setMobileCanRight);
    };

    update();

    const desktopEl = desktopNavRef.current;
    const mobileEl = mobileDockRef.current;

    desktopEl?.addEventListener("scroll", update, { passive: true });
    mobileEl?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    const t = window.setTimeout(update, 250);

    return () => {
      window.clearTimeout(t);
      desktopEl?.removeEventListener("scroll", update);
      mobileEl?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [pathname, isTouchLandscape]);

  function fireSoftHaptic() {
    if (typeof window === "undefined") return;
    if (!("vibrate" in navigator)) return;

    try {
      navigator.vibrate(8);
    } catch {}
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
    if (isDesktop) return;

    try {
      const saved = localStorage.getItem("gg_forceDesktop");
      if (saved === "1") setForceDesktop(true);
    } catch {}
  }, [isDesktop]);

  React.useEffect(() => {
    function ensureViewportMeta(): HTMLMetaElement | null {
      try {
        let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = "viewport";
          document.head.appendChild(meta);
        }
        return meta;
      } catch {
        return null;
      }
    }

    const setViewport = () => {
      const meta = ensureViewportMeta();
      if (!meta) return;

      if (isDesktop) {
        meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
        try {
          localStorage.removeItem("gg_forceDesktop");
        } catch {}
        document.documentElement.classList.remove("force-desktop");
        return;
      }

      const desktopWidth = 1100;

      if (forceDesktop) {
        const deviceW = Math.max(window.innerWidth, document.documentElement.clientWidth || 0);
        const scale = Math.max(0.25, Math.min(1, deviceW / desktopWidth));
        meta.setAttribute("content", `width=${desktopWidth}, initial-scale=${scale}, viewport-fit=cover`);
        document.documentElement.classList.add("force-desktop");
      } else {
        meta.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
        document.documentElement.classList.remove("force-desktop");
      }
    };

    try {
      if (!isDesktop) localStorage.setItem("gg_forceDesktop", forceDesktop ? "1" : "0");
    } catch {}

    setViewport();

    if (!isDesktop && forceDesktop) {
      const onResize = () => setViewport();
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
      };
    }
  }, [isDesktop, forceDesktop]);

  React.useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const { data } = await supabaseClient.auth.getUser();
        const user = data?.user ?? null;
        if (!user || !mounted) return;

        const meta = user.user_metadata as any;
        const nameFromMeta = buildNameFromMetadata(meta);

        let resolvedName: string | null = null;
        const email = user.email ?? null;

        if (mounted) setUserEmail(email);

        let appUserId: string | null = null;

        if (email) {
          try {
            const { data: row, error } = await supabaseClient
  .from("app_users")
  .select("id, full_name")
  .ilike("email", email)
  .maybeSingle();

console.log("app_users profile row:", { row, error, email });

if (!error && row) {
              appUserId = (row as any).id ?? null;

              const appUserName = cleanName((row as any)?.full_name ?? null);
              if (appUserName) resolvedName = appUserName;
            }
          } catch (err) {
  console.warn("Failed to load app_users profile:", err);
}
        }

        if (!resolvedName) resolvedName = nameFromMeta;
        if (mounted) setUserName(resolvedName ?? null);

        const [invoiceRes, aptRes] = await Promise.all([
          appUserId
            ? supabaseClient
                .from("tech_invoices")
                .select("id, status, client_id")
                .eq("client_id", appUserId)
                .eq("status", "sent")
                .limit(1)
            : Promise.resolve({ data: [], error: null } as any),

          email
            ? supabaseClient
                .from("appointments")
                .select("id, status, customer_email")
                .eq("customer_email", email)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (!mounted) return;

        if (!invoiceRes.error && invoiceRes.data) {
          setHasOpenInvoice(invoiceRes.data.length > 0);
        }

        if (!aptRes.error && aptRes.data) {
          const normalized = (aptRes.data ?? []).map((a: any) => ({
            id: String(a.id),
            status: a.status ?? null,
          })) as AppointmentLite[];

          setCustomerAppointments(normalized);

          const active = aptRes.data.some((a: any) => {
            const s = (a.status ?? "").toLowerCase();
            return !["completed", "cancelled", "canceled", "paid"].includes(s);
          });

          setHasActiveAppointment(active);
        }
      } catch {}
    }

    hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const personalizedMessage = React.useMemo(() => {
    const nameVal = userName || "there";

    const baseA: Array<(n: string) => string> = [
      (n) => `From first crack to final shine — we’ve got you, ${n}.`,
      (n) => `Windshield worries off your mind, ${n}. Drive, we’ll handle the glass.`,
      (n) => `${n}, your glass is today’s main character.`,
      (n) => `Chips, cracks, road rash — we keep your glass ready, ${n}.`,
      (n) => `Park easy, ${n} — we’re on glass watch.`,
      (n) => `Glass stress down, road confidence up, ${n}.`,
      (n) => `${n}, every drive should look day-one fresh.`,
    ];

    const baseB: Array<(n: string) => string> = [
      (n) => `Heads up, ${n} — your invoices live under Invoices whenever you’re ready.`,
      (n) => `${n}, your billing trail is tucked neatly in Invoices.`,
    ];

    const baseC: Array<(n: string) => string> = [
      (n) => `${n}, your appointments update in real time — no guessing, just progress.`,
      (n) => `We’ll keep your appointment status crystal clear, ${n}.`,
    ];

    const baseD: Array<(n: string) => string> = [
      (n) => `${n}, consider this your personal glass command center.`,
      (n) => `Welcome back, ${n}. Your glass, your data, one cockpit.`,
    ];

    const pool = [...baseA, baseA[0], baseB[0], baseC[0], baseD[0]];

    const key = nameVal.toLowerCase();
    const seed =
      key.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
      (hasOpenInvoice ? 7 : 0) +
      (hasActiveAppointment ? 13 : 0);

    const pick = pool[Math.abs(seed) % pool.length] ?? baseA[0];
    let msg = pick(nameVal);

    const extras: string[] = [];
    if (hasOpenInvoice) extras.push("You’ve got a repair invoice waiting under Invoices.");
    if (hasActiveAppointment) extras.push("We’ll keep your appointment tracker updated step by step.");
    if (extras.length > 0) msg = `${msg} ${extras.join(" ")}`;

    return msg;
  }, [userName, hasOpenInvoice, hasActiveAppointment]);

  return (
    <div className="user-mobile-fullscreen relative min-h-[100svh] overflow-x-clip bg-[#040812] text-slate-50">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[90] rounded bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950"
      >
        Skip to content
      </a>

      <RadiantBackdrop reduced={!!prefersReducedMotion} />

      <motion.aside
        initial={false}
        animate={{ width: sidebarExpanded ? 284 : 88 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="user-side-nav fixed left-0 top-0 z-40 hidden h-screen border-r border-white/10 bg-[#07111f]/82 shadow-[24px_0_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl lg:block xl:hidden"
        aria-label="Primary navigation"
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="relative border-b border-white/8 p-4">
            <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/35 to-transparent" />

            <div className="flex items-center gap-3">
              <motion.div
                animate={!sidebarExpanded ? { scale: [1, 1.035, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-sky-300/18 bg-white/[0.06] shadow-[0_18px_38px_rgba(56,189,248,0.14),inset_0_1px_0_rgba(255,255,255,0.12)]"
              >
                <UserLayoutTopDiamond />
              </motion.div>

              <AnimatePresence initial={false}>
                {sidebarExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="min-w-0"
                  >
                    <div className="truncate text-[10px] uppercase tracking-[0.24em] text-sky-100/56">
                      Glass Guardian
                    </div>
                    <div className="truncate text-sm font-semibold text-white/92">
                      User Portal
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
                      Welcome
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-white/88">
                      {userName || "Glass Guardian customer"}
                    </div>
                    <div className="mt-2 line-clamp-3 text-[0.7rem] leading-snug text-white/52">
                      {personalizedMessage}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
            <div className="space-y-2">
              {TABS.map((tab) => {
                const active = isActiveTab(pathname, tab.href);
                const Icon = tab.icon;
                const urgent = tab.href === "/user/dashboard/pay" && hasOpenInvoice;

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    title={!sidebarExpanded ? tab.label : undefined}
                    className={[
                      "user-side-link relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-sm transition-all duration-200",
                      active
                        ? "border-sky-300/34 bg-sky-300/13 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.18),0_16px_34px_rgba(2,8,23,0.34),0_0_34px_rgba(56,189,248,0.12)]"
                        : "border-white/8 bg-white/[0.035] text-white/66 hover:border-sky-300/18 hover:bg-white/[0.06] hover:text-white",
                    ].join(" ")}
                  >
                    {active && (
                      <motion.span
                        layoutId="user-side-active-glow"
                        className="absolute inset-0 rounded-2xl bg-[radial-gradient(240px_70px_at_20%_0%,rgba(125,211,252,0.22),transparent_70%)]"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}

                    <motion.span
                      whileHover={!sidebarExpanded ? { scale: 1.12 } : { scale: 1.03 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/15"
                    >
                      <Icon className="h-4 w-4" />
                      {urgent && (
                        <span className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500/80 opacity-80" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-400" />
                        </span>
                      )}
                    </motion.span>

                    <AnimatePresence initial={false}>
                      {sidebarExpanded && (
                        <motion.span
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-2"
                        >
                          <span className="truncate">{tab.label}</span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
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
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/28 bg-emerald-300/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-100">
                    <Activity className="h-3.5 w-3.5" />
                    Protected portal
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      <div
        className={[
          "user-content-shell relative z-10 min-h-[100svh] pt-[calc(env(safe-area-inset-top)+82px)] transition-[padding] duration-300 lg:pl-[88px] lg:pt-0 xl:pl-0 xl:pt-[154px]",
          isTouchLandscape ? "user-touch-landscape-shell" : "",
        ].join(" ")}
      >
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
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
              <div className="absolute inset-y-0 left-0 w-[38%] bg-[radial-gradient(420px_180px_at_10%_0%,rgba(255,255,255,0.10),transparent_68%)]" />
              <div className="absolute inset-y-0 right-0 w-[32%] bg-[radial-gradient(320px_160px_at_100%_0%,rgba(56,189,248,0.12),transparent_66%)]" />

              <div className="relative z-10 flex min-w-0 items-center gap-3">
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9, y: 8 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={[
                    "relative grid shrink-0 place-items-center rounded-2xl border border-sky-300/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] shadow-[0_18px_38px_rgba(56,189,248,0.14),inset_0_1px_0_rgba(255,255,255,0.14)]",
                    condensed ? "h-10 w-10" : "h-11 w-11",
                  ].join(" ")}
                >
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_46%)]" />
                  <div className="relative z-10">
                    <UserLayoutTopDiamond />
                  </div>
                </motion.div>

                <div className="min-w-0 leading-tight">
                  <div className="mb-0.5 inline-flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-100/64">
                    <Sparkles className="h-3 w-3" />
                    Glass Guardian Command Center
                  </div>

                <div className="truncate bg-gradient-to-r from-slate-50 via-slate-200 to-slate-400 bg-clip-text text-base font-bold text-transparent md:text-xl">
                  Welcome back, {userName || "there"}! 👋
                </div>
               </div>
              </div>

              <div className="relative z-10 flex min-w-0 flex-1 justify-center px-4">
                <div className="max-w-[520px] truncate text-center text-xs leading-5 text-white/58">
                  {personalizedMessage}
                </div>
              </div>

              <div className="relative z-10 flex shrink-0 items-center gap-2.5 md:gap-3">
                {hasActiveAppointment && (
                  <Link
                    href="/user/dashboard/appointments"
                    className="user-nav-pill inline-flex items-center gap-2 rounded-full border border-emerald-300/28 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-100 shadow-[0_12px_24px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-emerald-300/14"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Active repair
                  </Link>
                )}

                {hasOpenInvoice && (
                  <Link
                    href="/user/dashboard/pay"
                    className="user-nav-pill inline-flex items-center gap-2 rounded-full border border-rose-300/28 bg-rose-300/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-rose-100 shadow-[0_12px_24px_rgba(248,113,113,0.08),inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-rose-300/14"
                  >
                    <ReceiptText className="h-3.5 w-3.5" />
                    Invoice ready
                    <span className="h-2 w-2 rounded-full bg-rose-300 shadow-[0_0_16px_rgba(252,165,165,0.8)]" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          <nav className="mt-3 border-t border-white/6 bg-transparent">
            <div className="mx-auto w-full max-w-[1180px] px-4">
              <div className="relative">
                <ScrollArrow
                  direction="left"
                  visible={desktopCanLeft}
                  onClick={() => scrollTabs(desktopNavRef.current, "left")}
                />
                <ScrollArrow
                  direction="right"
                  visible={desktopCanRight}
                  onClick={() => scrollTabs(desktopNavRef.current, "right")}
                />

                <div
                  ref={desktopNavRef}
                  className={[
                    "mx-auto flex justify-start gap-2 overflow-x-auto px-10 pr-10 transition-all duration-300 scrollbar-none",
                    condensed ? "py-2" : "py-3",
                  ].join(" ")}
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {TABS.map((tab, idx) => {
                    const active = isActiveTab(pathname, tab.href);
                    const Icon = tab.icon;
                    const urgent = tab.href === "/user/dashboard/pay" && hasOpenInvoice;

                    return (
                      <motion.div
                        key={tab.href}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: idx * 0.03 }}
                        className="shrink-0"
                      >
                        <Link
                          href={tab.href}
                          className={[
                            "user-nav-primary relative inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 md:text-[13px]",
                            active
                              ? "border-sky-300/34 bg-[linear-gradient(180deg,rgba(56,189,248,0.18),rgba(59,130,246,0.12))] text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_16px_34px_rgba(2,8,23,0.42),inset_0_1px_0_rgba(255,255,255,0.14)]"
                              : "border-white/10 bg-white/[0.045] text-white/72 shadow-[0_10px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-sky-300/18 hover:bg-white/[0.07] hover:text-white",
                          ].join(" ")}
                        >
                          <span className="relative">
                            <Icon className="h-3.5 w-3.5 opacity-80" />
                            {urgent && (
                              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-300 shadow-[0_0_16px_rgba(252,165,165,0.8)]" />
                            )}
                          </span>
                          {tab.label}
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>
        </header>

        <header
          className={[
            "user-mobile-topbar fixed left-0 right-0 top-0 z-50 border-b border-white/8 bg-[#07111f]/82 px-3 backdrop-blur-2xl transition-all duration-300 lg:hidden",
            condensed ? "pb-2" : "pb-3",
          ].join(" ")}
        >
          <div className="relative flex min-h-[60px] items-center justify-between gap-3 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] px-4 shadow-[0_18px_50px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
            <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(220px_90px_at_0%_0%,rgba(125,211,252,0.15),transparent_68%)]" />
            <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(180px_80px_at_100%_0%,rgba(16,185,129,0.12),transparent_70%)]" />

            <div className="relative z-10 flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-sky-300/18 bg-white/[0.07] shadow-[0_12px_28px_rgba(56,189,248,0.10)]">
                <UserLayoutTopDiamond />
              </div>

              <div className="min-w-0">
  <div className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-100/58">
    Command Center
  </div>

  <div className="truncate bg-gradient-to-r from-slate-50 via-slate-200 to-slate-400 bg-clip-text text-sm font-bold text-transparent">
    Welcome back, {userName || "there"} 👋
  </div>
</div>
            </div>

            <Link
              href={activeTab.href}
              aria-label={`Current page: ${activeTab.label}`}
              className="user-mobile-icon-button relative z-10 grid h-10 min-w-10 shrink-0 place-items-center rounded-full border border-sky-300/18 bg-sky-300/10 px-3 text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <ActiveIcon className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main
          id="content"
          key={pathname}
          className="user-main-content relative z-10 isolate min-h-[calc(100svh-80px)] overflow-visible pb-[calc(env(safe-area-inset-bottom)+13.5rem)] lg:pb-12"
        >
          <motion.div
            key={pathname}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-0 isolate min-h-[calc(100svh-80px)] px-4 md:px-6 xl:px-8"
          >
            <div className="mx-auto w-full max-w-7xl">
              {children}
              <SecurityRail />
            </div>
          </motion.div>
        </main>
      </div>

      <nav className="user-mobile-dock fixed inset-x-0 bottom-0 z-50 px-3 lg:hidden">
        <div className="mx-auto max-w-[580px]">
          <div className="relative rounded-[28px] border border-white/10 bg-[#07111f]/92 p-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-[0_-18px_55px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
            <ScrollArrow
              direction="left"
              visible={mobileCanLeft}
              onClick={() => scrollTabs(mobileDockRef.current, "left")}
            />
            <ScrollArrow
              direction="right"
              visible={mobileCanRight}
              onClick={() => scrollTabs(mobileDockRef.current, "right")}
            />

            <div className="pointer-events-none absolute inset-y-2 left-0 z-10 w-10 rounded-l-[26px] bg-gradient-to-r from-[#07111f] to-transparent" />
            <div className="pointer-events-none absolute inset-y-2 right-0 z-10 w-10 rounded-r-[26px] bg-gradient-to-l from-[#07111f] to-transparent" />

            <div
              ref={mobileDockRef}
              className="user-mobile-tab-scroller flex gap-1 overflow-x-auto scroll-smooth px-8 scrollbar-none"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {TABS.map((tab) => {
                const active = isActiveTab(pathname, tab.href);
                const Icon = tab.icon;
                const urgent = tab.href === "/user/dashboard/pay" && hasOpenInvoice;

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      "user-mobile-tab relative flex min-w-[4.55rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-[10px] transition",
                      active
                        ? "border-sky-300/30 bg-sky-300/12 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.16)]"
                        : "border-transparent text-white/52 hover:bg-white/[0.055] hover:text-white",
                    ].join(" ")}
                  >
                    {active && (
                      <motion.span
                        layoutId="user-mobile-active-glow"
                        className="absolute inset-0 rounded-2xl bg-[radial-gradient(80px_40px_at_50%_0%,rgba(125,211,252,0.22),transparent_75%)]"
                      />
                    )}

                    <span className="relative z-10">
                      <Icon className="h-4 w-4" />
                      {urgent && (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-300 shadow-[0_0_12px_rgba(252,165,165,0.9)]" />
                      )}
                    </span>

                    <span className="relative z-10 max-w-full truncate">
                      {tab.shortLabel || tab.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      <FloatingSupportBubble
        open={supportOpen}
        setOpen={setSupportOpen}
        isDesktop={isDesktop}
        isLandscape={isLandscape}
        isTouchLandscape={isTouchLandscape}
        userEmail={userEmail}
        userName={userName}
        appointments={customerAppointments}
      />

      {!isDesktop && (
        <div className="user-desktop-toggle fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[66]">
          <button
            type="button"
            onClick={() => setForceDesktop((s) => !s)}
            aria-pressed={forceDesktop}
            aria-label={forceDesktop ? "Exit desktop view" : "Switch to desktop view"}
            className="inline-flex items-center justify-center rounded-full border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            {forceDesktop ? "Exit desktop" : "Desktop"}
          </button>
        </div>
      )}

      <style jsx global>{`
        html,
        body {
          min-height: 100%;
          background: #040812;
          overflow-x: hidden;
          overflow-y: auto;
        }

        @supports (height: 100dvh) {
          .user-mobile-fullscreen {
            min-height: 100dvh;
          }
        }

        .user-mobile-topbar {
          padding-top: env(safe-area-inset-top);
        }

        .user-mobile-dock {
          padding-bottom: max(env(safe-area-inset-bottom), 8px);
          pointer-events: none;
        }

        .user-mobile-dock > * {
          pointer-events: auto;
        }

        .user-nav-primary,
        .user-nav-pill,
        .user-side-link,
        .user-mobile-tab,
        .user-mobile-icon-button,
        .user-support-bubble,
        .user-scroll-arrow {
          position: relative;
          overflow: hidden;
          transform-origin: center;
          will-change: transform, box-shadow;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .user-scroll-arrow {
          position: absolute;
        }

        .user-nav-primary::before,
        .user-nav-pill::before,
        .user-side-link::before,
        .user-mobile-tab::before,
        .user-mobile-icon-button::before,
        .user-support-bubble::before,
        .user-scroll-arrow::before {
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

        .user-nav-primary:hover,
        .user-nav-pill:hover,
        .user-side-link:hover,
        .user-mobile-tab:hover,
        .user-mobile-icon-button:hover,
        .user-support-bubble:hover,
        .user-scroll-arrow:hover {
          transform: translateY(-1px) scale(1.02);
        }

        .user-mobile-tab:active,
        .user-mobile-icon-button:active,
        .user-support-bubble:active,
        .user-scroll-arrow:active {
          transform: scale(0.96);
        }

        .user-nav-primary:hover {
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, 0.22),
            0 16px 34px rgba(2, 8, 23, 0.46),
            0 0 28px rgba(56, 189, 248, 0.18);
        }

        .user-nav-pill:hover {
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, 0.14),
            0 14px 30px rgba(2, 8, 23, 0.4),
            0 0 22px rgba(56, 189, 248, 0.12);
        }

        .user-nav-primary:hover::before,
        .user-nav-pill:hover::before,
        .user-side-link:hover::before,
        .user-mobile-tab:hover::before,
        .user-mobile-icon-button:hover::before,
        .user-support-bubble:hover::before,
        .user-scroll-arrow:hover::before {
          opacity: 1;
          transform: scale(1);
        }

        .user-nav-primary::after,
        .user-mobile-tab::after {
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

        .user-nav-primary:hover::after,
        .user-mobile-tab:active::after {
          animation: user-nav-ripple 650ms ease-out forwards;
        }

        @keyframes user-nav-ripple {
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

        @media (max-width: 1023px) {
          body {
            overscroll-behavior-y: auto;
          }
        }

        @media (orientation: landscape) and (pointer: coarse) and (max-height: 540px) {
          .user-side-nav {
            display: none !important;
          }

          .user-content-shell {
            padding-left: 0 !important;
            padding-top: calc(env(safe-area-inset-top) + 72px) !important;
          }

          .user-mobile-topbar {
            display: block !important;
          }

          .user-mobile-topbar > div {
            min-height: 52px !important;
            border-radius: 20px !important;
          }

          .user-mobile-dock {
            display: block !important;
            left: auto !important;
            right: max(0.65rem, env(safe-area-inset-right)) !important;
            top: calc(env(safe-area-inset-top) + 78px) !important;
            bottom: auto !important;
            width: 5.75rem !important;
            padding: 0 !important;
          }

          .user-mobile-dock > div {
            max-width: none !important;
          }

          .user-mobile-dock > div > div {
            border-radius: 24px !important;
            padding: 0.45rem !important;
            padding-bottom: 0.45rem !important;
          }

          .user-mobile-tab-scroller {
            max-height: calc(100dvh - 104px) !important;
            flex-direction: column !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            padding: 2rem 0 !important;
          }

          .user-mobile-tab {
            min-width: 0 !important;
            min-height: 4.25rem !important;
            width: 100% !important;
          }

          .user-scroll-arrow {
            left: 50% !important;
            right: auto !important;
            top: auto !important;
            transform: translateX(-50%) !important;
          }

          .user-scroll-arrow.left-1 {
            top: 0.25rem !important;
            rotate: 90deg;
          }

          .user-scroll-arrow.right-1 {
            bottom: 0.25rem !important;
            rotate: 90deg;
          }

          .user-main-content {
            padding-right: 6.45rem !important;
            padding-bottom: 2rem !important;
          }

          .user-desktop-toggle {
            right: auto !important;
            left: max(0.75rem, env(safe-area-inset-left)) !important;
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