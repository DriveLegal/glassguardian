"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Mail,
  Send,
  MessageSquare,
  Search,
  Sparkles,
  ShieldCheck,
  Clock3,
  ChevronRight,
  Inbox,
  Loader2,
  User,
  ClipboardList,
  ArrowUpRight,
  Layers,
  Orbit,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AnyObj = Record<string, any>;
type FilterValue = "all" | "appointment" | "general";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function threadKey(m: AnyObj, agentEmail: string) {
  const scope = m.appointment_id || "general";
  const counterpart =
    m.sender_email === agentEmail ? m.recipient_email : m.sender_email;
  return `${scope}::${counterpart}`;
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMessageTime(value: string | null | undefined) {
  const d = safeDate(value);
  if (!d) return "";
  return format(d, "MMM d, h:mm a");
}

function formatMessageDay(value: string | null | undefined) {
  const d = safeDate(value);
  if (!d) return "";
  return format(d, "EEEE, MMM d");
}

function getEmailInitial(email?: string | null) {
  return String(email ?? "?").trim().charAt(0).toUpperCase() || "?";
}

function getThreadCounterpartEmail(
  m: AnyObj,
  agentEmail: string | null
): string {
  if (!agentEmail) return m.sender_email || m.recipient_email || "Unknown";
  return m.sender_email === agentEmail ? m.recipient_email : m.sender_email;
}

function getMessageRoleLabel(m: AnyObj, mine: boolean) {
  if (mine) return "Support";
  if (m.sender_role === "support" || m.sender_role === "admin") return "Team";
  return "Customer";
}

/**
 * Glass Guardian liquid graphite glass
 * - graphite base
 * - soft neutral glass reflections
 * - selective gold accents only
 * - added hover shimmer / depth shift / light refraction
 */

function GlassShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[30px]",
        "border border-[rgba(255,255,255,0.08)]",
        "bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))]",
        "backdrop-blur-[28px]",
        "shadow-[0_26px_70px_rgba(0,0,0,0.55),0_10px_26px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.35)]",
        className
      )}
    >
      {/* neutral top specular edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.12)] to-transparent" />

      {/* glass lensing */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.65] [background-image:radial-gradient(120%_85%_at_12%_0%,rgba(255,255,255,0.06),transparent_38%),radial-gradient(90%_80%_at_98%_6%,rgba(212,175,55,0.08),transparent_40%),radial-gradient(80%_110%_at_45%_120%,rgba(120,120,120,0.08),transparent_42%)]" />

      {/* liquid sweep */}
      <div className="pointer-events-none absolute inset-y-0 right-[-16%] w-[50%] rotate-[6deg] bg-[linear-gradient(105deg,transparent_0%,rgba(255,255,255,0.015)_34%,rgba(255,255,255,0.07)_48%,rgba(255,255,255,0.025)_60%,transparent_78%)] blur-[1px]" />

      {/* gold edge shimmer on hover */}
      <div className="pointer-events-none absolute inset-y-0 left-[-30%] w-[42%] skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(246,215,118,0.10),transparent)] opacity-0 blur-xl transition-all duration-700 group-hover:left-[115%] group-hover:opacity-100" />

      {/* micro-noise */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22%3E%3Cfilter id=%22n%22 x=%220%22 y=%220%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%2260%22 height=%2260%22 filter=%22url(%23n)%22 opacity=%220.8%22/%3E%3C/svg%3E')]" />

      {children}
    </div>
  );
}

function GlassPill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-[rgba(255,255,255,0.10)]",
        "bg-[linear-gradient(180deg,rgba(18,20,26,0.78),rgba(10,11,15,0.90))] px-3 py-1.5",
        "text-[11px] font-medium uppercase tracking-[0.22em] text-white/85",
        "backdrop-blur-[22px]",
        "shadow-[0_14px_30px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.10)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.12)] to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(255,255,255,0.06),transparent_42%)]" />
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border px-4 py-3",
        "backdrop-blur-[22px]",
        "shadow-[0_14px_34px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.10)]",
        accent
          ? "border-[#D4AF37]/25 bg-[linear-gradient(180deg,rgba(40,32,12,0.42),rgba(18,20,26,0.90))]"
          : "border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.82),rgba(10,11,15,0.92))]"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          accent
            ? "bg-gradient-to-r from-transparent via-[#D4AF37]/35 to-transparent"
            : "bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.10)] to-transparent"
        )}
      />
      <div
        className={cn(
          "text-[11px] uppercase tracking-[0.22em]",
          accent ? "text-[#F6D776]" : "text-white/60"
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold",
          accent ? "text-[#F6D776]" : "text-white/90"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function OrbBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* deep space gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgba(212,175,55,0.18),transparent_45%),radial-gradient(40%_32%_at_92%_16%,rgba(255,215,120,0.12),transparent_55%),radial-gradient(30%_26%_at_12%_72%,rgba(120,120,120,0.10),transparent_60%),linear-gradient(180deg,#05060A_0%,#0A0B0F_40%,#05060A_100%)]" />

      {/* faint grid */}
      <div className="absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:44px_44px]" />

      {/* glowing orbs */}
      <div className="absolute left-[-10%] top-[-9rem] h-[26rem] w-[26rem] rounded-full bg-[#D4AF37]/12 blur-3xl" />
      <div className="absolute right-[-10%] top-[2rem] h-[26rem] w-[26rem] rounded-full bg-[#8A8A8A]/8 blur-3xl" />
      <div className="absolute bottom-[-12rem] left-[12%] h-[28rem] w-[36rem] rounded-full bg-[#3e434d]/14 blur-3xl" />
      <div className="absolute bottom-[14%] right-[12%] h-[12rem] w-[12rem] rounded-full bg-[#F6D776]/6 blur-3xl" />

      {/* subtle refraction layer */}
      <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_22%),radial-gradient(circle_at_75%_15%,rgba(255,255,255,0.35),transparent_18%),radial-gradient(circle_at_68%_75%,rgba(212,175,55,0.6),transparent_20%)] blur-3xl" />
    </div>
  );
}

export default function AdminMessagesPage() {
  const queryClient = useQueryClient();

  const [agentEmail, setAgentEmail] = React.useState<string | null>(null);
  const [activeThread, setActiveThread] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const [search, setSearch] = React.useState("");
  const [compose, setCompose] = React.useState({
    subject: "",
    body: "",
    appointment_id: "",
  });

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const email = data?.session?.user?.email ?? null;
      setAgentEmail(email);
    })();
  }, []);

  const { data: allMessages = [], isLoading } = useQuery({
    queryKey: ["admin:messages"],
    enabled: !!agentEmail,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });

  React.useEffect(() => {
    if (!agentEmail) return;

    const ch = supabaseClient
      .channel("messages:admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin:messages"] });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(ch);
    };
  }, [agentEmail, queryClient]);

  const threads = React.useMemo(() => {
    const map = new Map<string, { last: AnyObj; count: number }>();

    for (const m of allMessages) {
      const key = threadKey(m, agentEmail || "");
      const prev = map.get(key);

      if (!prev) {
        map.set(key, { last: m, count: 1 });
        continue;
      }

      const prevDate = safeDate(prev.last.created_at)?.getTime() ?? 0;
      const nextDate = safeDate(m.created_at)?.getTime() ?? 0;

      map.set(key, {
        last: nextDate > prevDate ? m : prev.last,
        count: prev.count + 1,
      });
    }

    let arr = Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));

    if (filter === "appointment") arr = arr.filter((t) => !!t.last.appointment_id);
    if (filter === "general") arr = arr.filter((t) => !t.last.appointment_id);

    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((t) => {
        const m = t.last;
        const party = getThreadCounterpartEmail(m, agentEmail).toLowerCase();
        const subject = String(m.subject ?? "").toLowerCase();
        const body = String(m.body ?? "").toLowerCase();
        const appt = String(m.appointment_id ?? "").toLowerCase();

        return (
          party.includes(q) ||
          subject.includes(q) ||
          body.includes(q) ||
          appt.includes(q)
        );
      });
    }

    return arr.sort((a, b) => {
      const aTime = safeDate(a.last.created_at)?.getTime() ?? 0;
      const bTime = safeDate(b.last.created_at)?.getTime() ?? 0;
      return bTime - aTime;
    });
  }, [allMessages, agentEmail, filter, search]);

  React.useEffect(() => {
    if (!threads.length) {
      setActiveThread(null);
      return;
    }
    if (!activeThread || !threads.some((t) => t.key === activeThread)) {
      setActiveThread(threads[0]?.key ?? null);
    }
  }, [threads, activeThread]);

  const activeMessages = React.useMemo(() => {
    if (!activeThread) return [];
    return allMessages
      .filter((m: AnyObj) => threadKey(m, agentEmail || "") === activeThread)
      .sort((a: AnyObj, b: AnyObj) => {
        const aTime = safeDate(a.created_at)?.getTime() ?? 0;
        const bTime = safeDate(b.created_at)?.getTime() ?? 0;
        return aTime - bTime;
      });
  }, [activeThread, allMessages, agentEmail]);

  const counterpartEmail = React.useMemo(() => {
    if (!activeThread) return null;
    const [, email] = activeThread.split("::");
    return email || null;
  }, [activeThread]);

  const appointmentIdForThread = React.useMemo(() => {
    if (!activeThread) return "";
    const [scope] = activeThread.split("::");
    return scope !== "general" ? scope : "";
  }, [activeThread]);

  const activeThreadMeta = React.useMemo(() => {
    if (!activeMessages.length) return null;
    const latest = activeMessages[activeMessages.length - 1];
    return {
      counterpart: getThreadCounterpartEmail(latest, agentEmail),
      latest,
    };
  }, [activeMessages, agentEmail]);

  React.useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeThread]);

  const sendMutation = useMutation({
    mutationFn: async (data: AnyObj) => {
      if (!agentEmail || !counterpartEmail) {
        throw new Error("Missing sender or recipient address");
      }

      const { error } = await supabaseClient.from("messages").insert({
        subject: data.subject || null,
        body: data.body,
        appointment_id: data.appointment_id || null,
        sender_email: agentEmail,
        sender_role: "support",
        recipient_email: counterpartEmail,
        message_type: data.appointment_id ? "appointment" : "support",
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin:messages"] });
      setCompose((c) => ({ ...c, body: "" }));

      requestAnimationFrame(() => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    },
  });

  const totalThreads = threads.length;
  const appointmentThreads = threads.filter((t) => !!t.last.appointment_id).length;
  const generalThreads = threads.filter((t) => !t.last.appointment_id).length;

  return (
    <div className="min-h-screen bg-[#04050a] text-white">
      <div className="relative overflow-hidden">
        <OrbBackdrop />

        <div className="relative mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">
          {/* Floating liquid-glass navigation layer (flows above content) */}
          <div className="sticky top-3 z-50 mb-6">
            <GlassShell className="rounded-[28px] transition-transform duration-300 hover:-translate-y-[1px]">
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-4 md:p-5">
                <div className="flex items-center gap-3">
                  <div className="relative grid h-11 w-11 place-items-center rounded-[18px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] shadow-[0_18px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.10)]">
                    <div className="pointer-events-none absolute inset-[1px] rounded-[17px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_52%)]" />
                    <Layers className="h-5 w-5 text-[#F6D776]" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <GlassPill>
                        <ShieldCheck className="h-3.5 w-3.5 text-[#F6D776]" />
                        Support Portal
                      </GlassPill>
                      <GlassPill className="hidden md:inline-flex">
                        <Orbit className="h-3.5 w-3.5 text-white/70" />
                        Liquid Glass Navigation Layer
                      </GlassPill>
                    </div>
                    <div className="mt-2 text-sm text-white/60">
                      Signed in as{" "}
                      <span className="font-medium text-white/90">
                        {agentEmail || "current session"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:min-w-[360px]">
                  <MiniStat label="Total" value={totalThreads} />
                  <MiniStat label="Appointment" value={appointmentThreads} accent />
                  <MiniStat label="General" value={generalThreads} />
                </div>
              </div>
            </GlassShell>
          </div>

          {/* Hero */}
          <GlassShell className="mb-6 transition-transform duration-300 hover:-translate-y-[1px]">
            <div className="relative p-5 md:p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="relative grid h-14 w-14 place-items-center rounded-[20px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] shadow-[0_18px_44px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.10)]">
                      <div className="pointer-events-none absolute inset-[1px] rounded-[19px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_44%,rgba(255,255,255,0.03)_100%)]" />
                      <MessageSquare className="relative h-6 w-6 text-[#F6D776]" />
                    </div>

                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                        Messages
                      </h1>
                      <p className="mt-1 text-sm text-white/65 md:text-[15px]">
                        High-res liquid glass, 3D depth, and a floating navigation layer that stays above the content.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-[22px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] px-3 py-2 text-xs text-white/72 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Sparkles className="h-4 w-4 text-[#F6D776]" />
                  Liquid glass UI upgrade (no logic changes)
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search email, subject, body, or appointment ID..."
                    className="h-12 rounded-[20px] !border-[rgba(255,255,255,0.08)] !bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] pl-11 !text-white placeholder:!text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl focus-visible:!ring-[#D4AF37]/25"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-[20px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] px-3 py-2 text-xs text-white/68 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <Mail className="h-4 w-4 text-white/65" />
                  3D glass / high contrast
                </div>
              </div>
            </div>
          </GlassShell>

          {/* Filters */}
          <GlassShell className="mb-6 transition-transform duration-300 hover:-translate-y-[1px]">
            <div className="p-5">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-white/90">
                <ClipboardList className="h-4 w-4 text-[#F6D776]" />
                Inbox Filters
              </div>

              <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
                <TabsList className="grid w-full grid-cols-3 rounded-[20px] !border !border-[rgba(255,255,255,0.08)] !bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] p-1 md:w-[440px]">
                  <TabsTrigger
                    value="all"
                    className="rounded-[16px] !text-white/55 data-[state=active]:!bg-[linear-gradient(180deg,rgba(18,20,26,0.92),rgba(10,11,15,0.98))] data-[state=active]:!text-white data-[state=active]:shadow-[0_10px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="appointment"
                    className="rounded-[16px] !text-white/55 data-[state=active]:!bg-[linear-gradient(180deg,rgba(40,32,12,0.55),rgba(18,20,26,0.95))] data-[state=active]:!text-[#F6D776] data-[state=active]:shadow-[0_10px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(212,175,55,0.10)]"
                  >
                    Appointment
                  </TabsTrigger>
                  <TabsTrigger
                    value="general"
                    className="rounded-[16px] !text-white/55 data-[state=active]:!bg-[linear-gradient(180deg,rgba(18,20,26,0.92),rgba(10,11,15,0.98))] data-[state=active]:!text-white data-[state=active]:shadow-[0_10px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    General
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </GlassShell>

          <div className="grid grid-cols-12 gap-6">
            {/* Thread Rail */}
            <GlassShell className="col-span-12 lg:col-span-4 transition-transform duration-300 hover:-translate-y-[1px]">
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-lg font-semibold text-white/90">
                    <Inbox className="h-5 w-5 text-[#F6D776]" />
                    Conversations
                  </div>

                  <Badge className="!border-[rgba(255,255,255,0.10)] !bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] !text-white hover:!bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))]">
                    {threads.length}
                  </Badge>
                </div>

                {isLoading ? (
                  <div className="grid min-h-[280px] place-items-center rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.82),rgba(10,11,15,0.92))] backdrop-blur-xl">
                    <div className="flex items-center gap-3 text-sm text-white/65">
                      <Loader2 className="h-4 w-4 animate-spin text-[#F6D776]" />
                      Loading conversations...
                    </div>
                  </div>
                ) : threads.length === 0 ? (
                  <div className="grid min-h-[280px] place-items-center rounded-[24px] border border-dashed border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.82),rgba(10,11,15,0.92))] px-6 text-center backdrop-blur-xl">
                    <div>
                      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))]">
                        <Mail className="h-6 w-6 text-white/45" />
                      </div>
                      <div className="text-sm font-medium text-white/85">No conversations found</div>
                      <div className="mt-1 text-xs text-white/55">New customer messages will appear here.</div>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
                    {threads.map((t) => {
                      const m = t.last;
                      const isActive = activeThread === t.key;
                      const party = getThreadCounterpartEmail(m, agentEmail);
                      const scopeIsAppointment = !!m.appointment_id;

                      return (
                        <button
                          key={t.key}
                          onClick={() => {
                            setActiveThread(t.key);
                            setCompose((c) => ({
                              ...c,
                              appointment_id: m.appointment_id || "",
                            }));
                          }}
                          className={cn(
                            "group relative w-full overflow-hidden rounded-[24px] border p-3 text-left transition-all duration-200 hover:-translate-y-[1px]",
                            "shadow-[0_14px_36px_rgba(0,0,0,0.30)] backdrop-blur-xl",
                            isActive
                              ? "border-[#D4AF37]/40 bg-[linear-gradient(180deg,rgba(40,32,12,0.55),rgba(18,20,26,0.95))]"
                              : "border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] hover:border-[rgba(255,255,255,0.12)]"
                          )}
                        >
                          <div
                            className={cn(
                              "pointer-events-none absolute inset-x-0 top-0 h-px",
                              isActive
                                ? "bg-gradient-to-r from-transparent via-[#D4AF37]/35 to-transparent"
                                : "bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.12)] to-transparent"
                            )}
                          />
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(255,255,255,0.06),transparent_38%)]" />

                          {/* gold shimmer on hover */}
                          <div className="pointer-events-none absolute inset-y-0 left-[-30%] w-[36%] skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(246,215,118,0.12),transparent)] opacity-0 blur-xl transition-all duration-700 group-hover:left-[115%] group-hover:opacity-100" />

                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "relative mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-[16px] border text-sm font-semibold",
                                isActive
                                  ? "border-[#D4AF37]/30 bg-[linear-gradient(180deg,rgba(40,32,12,0.55),rgba(18,20,26,0.95))] text-[#F6D776]"
                                  : "border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] text-white/85"
                              )}
                            >
                              <div className="pointer-events-none absolute inset-[1px] rounded-[15px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_52%)]" />
                              {getEmailInitial(party)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white/92">
                                    {party}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {scopeIsAppointment ? (
                                      <Badge className="!border-[#D4AF37]/25 !bg-[linear-gradient(180deg,rgba(40,32,12,0.42),rgba(18,20,26,0.90))] !text-[10px] !text-[#F6D776] hover:!bg-[linear-gradient(180deg,rgba(40,32,12,0.42),rgba(18,20,26,0.90))]">
                                        Appt #{String(m.appointment_id).slice(0, 8)}
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="!border-[rgba(255,255,255,0.10)] !bg-transparent !text-[10px] !text-white/55"
                                      >
                                        General
                                      </Badge>
                                    )}

                                    <Badge
                                      variant="outline"
                                      className="!border-[rgba(255,255,255,0.08)] !bg-transparent !text-[10px] !text-white/45"
                                    >
                                      {t.count} {t.count === 1 ? "message" : "messages"}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <div className="text-[11px] text-white/50">
                                    {formatMessageTime(m.created_at)}
                                  </div>
                                  <ChevronRight
                                    className={cn(
                                      "ml-auto mt-2 h-4 w-4 transition-transform",
                                      isActive
                                        ? "text-[#F6D776]"
                                        : "text-white/40 group-hover:translate-x-0.5"
                                    )}
                                  />
                                </div>
                              </div>

                              {m.subject ? (
                                <div className="mt-2 truncate text-xs font-medium text-white/78">
                                  {m.subject}
                                </div>
                              ) : null}

                              <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/58">
                                {m.body}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </GlassShell>

            {/* Conversation */}
            <GlassShell className="col-span-12 lg:col-span-8 transition-transform duration-300 hover:-translate-y-[1px]">
              <div className="p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-lg font-semibold text-white/90">
                      <span>Conversation</span>
                      {appointmentIdForThread ? (
                        <Badge className="!border-[#D4AF37]/25 !bg-[linear-gradient(180deg,rgba(40,32,12,0.42),rgba(18,20,26,0.90))] !text-[10px] !text-[#F6D776] hover:!bg-[linear-gradient(180deg,rgba(40,32,12,0.42),rgba(18,20,26,0.90))]">
                          Appt #{String(appointmentIdForThread).slice(0, 8)}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="!border-[rgba(255,255,255,0.10)] !bg-transparent !text-[10px] !text-white/55"
                        >
                          General
                        </Badge>
                      )}
                    </div>

                    {activeThreadMeta ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/60">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-[#F6D776]" />
                          {activeThreadMeta.counterpart}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5 text-white/70" />
                          Last activity {formatMessageTime(activeThreadMeta.latest.created_at)}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-white/55">
                        Select a conversation to view details and reply.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] px-3 py-2 text-xs text-white/65 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    Support replies send from{" "}
                    <span className="font-medium text-white/90">
                      {agentEmail || "current session"}
                    </span>
                  </div>
                </div>

                {!activeThread ? (
                  <div className="grid min-h-[520px] place-items-center rounded-[26px] border border-dashed border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.82),rgba(10,11,15,0.92))] px-6 text-center backdrop-blur-xl">
                    <div>
                      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))]">
                        <MessageSquare className="h-7 w-7 text-white/55" />
                      </div>
                      <div className="text-base font-medium text-white/85">
                        Select a conversation
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        The full thread and reply composer will show here.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div
                      ref={scrollRef}
                      className="max-h-[54vh] overflow-y-auto rounded-[26px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.82),rgba(10,11,15,0.92))] p-3 md:p-4 backdrop-blur-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    >
                      <div className="space-y-4">
                        {activeMessages.map((m: AnyObj, index: number) => {
                          const mine = m.sender_email === agentEmail;
                          const prev = activeMessages[index - 1];
                          const showDayDivider =
                            !prev ||
                            formatMessageDay(prev.created_at) !==
                              formatMessageDay(m.created_at);

                          return (
                            <React.Fragment key={m.id}>
                              {showDayDivider ? (
                                <div className="sticky top-0 z-10 flex justify-center py-2">
                                  <div className="rounded-full border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] px-3 py-1 text-[11px] font-medium tracking-wide text-white/75 backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]">
                                    {formatMessageDay(m.created_at)}
                                  </div>
                                </div>
                              ) : null}

                              <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
                                <div
                                  className={cn(
                                    "group relative max-w-[92%] rounded-[24px] border px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-[1px] md:max-w-[78%]",
                                    mine
                                      ? "border-[#D4AF37]/30 bg-[linear-gradient(180deg,rgba(40,32,12,0.6),rgba(18,20,26,0.95))]"
                                      : "border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.85),rgba(10,11,15,0.92))]"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "pointer-events-none absolute inset-x-0 top-0 h-px",
                                      mine
                                        ? "bg-gradient-to-r from-transparent via-[#D4AF37]/35 to-transparent"
                                        : "bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.12)] to-transparent"
                                    )}
                                  />
                                  <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(100%_120%_at_0%_0%,rgba(255,255,255,0.08),transparent_34%)]" />

                                  {mine ? (
                                    <div className="pointer-events-none absolute inset-y-0 left-[-30%] w-[36%] skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(246,215,118,0.10),transparent)] opacity-0 blur-xl transition-all duration-700 group-hover:left-[115%] group-hover:opacity-100" />
                                  ) : null}

                                  <div className="mb-2 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-white/90">
                                        {mine ? "You" : m.sender_email}
                                      </div>
                                      <div
                                        className={cn(
                                          "mt-0.5 text-[11px] uppercase tracking-[0.18em]",
                                          mine ? "text-[#F6D776]/80" : "text-white/50"
                                        )}
                                      >
                                        {getMessageRoleLabel(m, mine)}
                                      </div>
                                    </div>

                                    <div className="shrink-0 text-[11px] text-white/50">
                                      {formatMessageTime(m.created_at)}
                                    </div>
                                  </div>

                                  {m.subject ? (
                                    <div
                                      className={cn(
                                        "mb-2 rounded-[18px] border px-3 py-2 text-sm font-medium",
                                        mine
                                          ? "border-[#D4AF37]/20 bg-[linear-gradient(180deg,rgba(40,32,12,0.38),rgba(18,20,26,0.78))] text-[#F6D776]"
                                          : "border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] text-white/78"
                                      )}
                                    >
                                      {m.subject}
                                    </div>
                                  ) : null}

                                  <div
                                    className={cn(
                                      "whitespace-pre-wrap text-sm leading-7",
                                      mine ? "text-white/88" : "text-white/82"
                                    )}
                                  >
                                    {m.body}
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Composer */}
                    <div className="relative overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] p-4 backdrop-blur-[26px] shadow-[0_22px_54px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.10)]">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.12)] to-transparent" />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_85%_at_12%_0%,rgba(255,255,255,0.08),transparent_40%)]" />

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!compose.body.trim()) return;

                          sendMutation.mutate({
                            subject: compose.subject || null,
                            body: compose.body,
                            appointment_id:
                              appointmentIdForThread || compose.appointment_id || null,
                          });
                        }}
                      >
                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white/90">
                              Reply to {counterpartEmail || "conversation"}
                            </div>
                            <div className="mt-1 text-xs text-white/55">
                              Premium liquid-glass reply composer.
                            </div>
                          </div>

                          {appointmentIdForThread ? (
                            <Badge className="!border-[#D4AF37]/25 !bg-[linear-gradient(180deg,rgba(40,32,12,0.42),rgba(18,20,26,0.90))] !text-[#F6D776] hover:!bg-[linear-gradient(180deg,rgba(40,32,12,0.42),rgba(18,20,26,0.90))]">
                              Appointment thread
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="!border-[rgba(255,255,255,0.10)] !bg-transparent !text-white/65"
                            >
                              General support
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Input
                            placeholder="Subject (optional)"
                            value={compose.subject}
                            onChange={(e) =>
                              setCompose((c) => ({ ...c, subject: e.target.value }))
                            }
                            className="h-11 rounded-[18px] !border-[rgba(255,255,255,0.08)] !bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] !text-white placeholder:!text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl focus-visible:!ring-[#D4AF37]/25"
                          />

                          <Textarea
                            placeholder="Type your reply..."
                            rows={5}
                            value={compose.body}
                            onChange={(e) =>
                              setCompose((c) => ({ ...c, body: e.target.value }))
                            }
                            className="min-h-[150px] rounded-[18px] !border-[rgba(255,255,255,0.08)] !bg-[linear-gradient(180deg,rgba(18,20,26,0.84),rgba(10,11,15,0.92))] !text-white placeholder:!text-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl focus-visible:!ring-[#D4AF37]/25"
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs text-white/50">
                            Sent as support from the admin portal.
                          </div>

                          <Button
                            type="submit"
                            disabled={sendMutation.isPending || !compose.body.trim()}
                            className={cn(
                              "h-11 rounded-[18px]",
                              "border border-[#D4AF37]/40",
                              "bg-[linear-gradient(180deg,#F6D776,#C9A93A)]",
                              "px-5 text-black font-semibold",
                              "shadow-[0_10px_30px_rgba(212,175,55,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]",
                              "transition-all hover:brightness-110",
                              "disabled:cursor-not-allowed disabled:opacity-60"
                            )}
                          >
                            {sendMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Reply
                                <ArrowUpRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </GlassShell>
          </div>
        </div>
      </div>
    </div>
  );
}