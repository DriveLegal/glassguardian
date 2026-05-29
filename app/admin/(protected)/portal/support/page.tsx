// app/admin/(protected)/portal/support/page.tsx
"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import {
  MessageSquare,
  Send,
  Mail,
  Clock,
  Search,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Sparkles,
  Inbox,
  CheckCircle2,
  AlertCircle,
  User,
  Circle,
} from "lucide-react";

/* ------------------------------- Types ------------------------------- */

type MessageRow = {
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

type ThreadRow = {
  id: string;
  key: string;
  subject: string | null;
  appointment_id: string | null;
  customer_email: string;
  customer_name: string | null;
  messages: MessageRow[];
  last_message_at: string | null;
  last_message_preview: string;
  unread_count: number;
};

/* ------------------------------ Constants ---------------------------- */

const SUPPORT_EMAIL = "info@glassguardianchipandcrackrepair.com";

/* ----------------------------- Data hooks ---------------------------- */

function useAllMessages() {
  return useQuery({
    queryKey: ["admin:support:messages"],
    queryFn: async () => {
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
        .order("created_at", { ascending: false })
        .limit(1500);

      if (error) throw error;
      return (data ?? []) as unknown as MessageRow[];
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

/* ------------------------------ Helpers ------------------------------ */

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

function getRoleLabel(role: MessageRow["sender_role"]) {
  if (!role) return "Unknown";
  if (role === "customer") return "Customer";
  if (role === "admin") return "Admin";
  if (role === "support") return "Support";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getCustomerEmailFromMessage(m: MessageRow) {
  const senderRole = normalizeText(m.sender_role);
  if (senderRole === "customer") return normalizeText(m.sender_email);
  return normalizeText(m.recipient_email || m.sender_email);
}

function getThreadSubject(m: MessageRow) {
  const s = String(m.subject ?? "").trim();
  if (!s) return "Support request";
  return s.replace(/^re:\s*/i, "").trim() || "Support request";
}

function buildThreadKey(m: MessageRow) {
  const customerEmail = getCustomerEmailFromMessage(m);
  const appointment = m.appointment_id ?? "no-appointment";
  const subject = getThreadSubject(m).toLowerCase();
  return `${customerEmail}__${appointment}__${subject}`;
}

function buildThreads(messages: MessageRow[]): ThreadRow[] {
  const map = new Map<string, MessageRow[]>();

  for (const m of messages) {
    const key = buildThreadKey(m);
    const existing = map.get(key) ?? [];
    existing.push(m);
    map.set(key, existing);
  }

  const threads: ThreadRow[] = Array.from(map.entries()).map(([key, rows]) => {
    const chronological = [...rows].sort(
      (a, b) => safeDate(a.created_at).getTime() - safeDate(b.created_at).getTime()
    );

    const latest = chronological[chronological.length - 1];
    const customerEmail = getCustomerEmailFromMessage(latest);
    const unreadCount = rows.filter(
      (m) => normalizeText(m.sender_role) === "customer" && !m.is_read
    ).length;

    return {
      id: key,
      key,
      subject: getThreadSubject(latest),
      appointment_id: latest.appointment_id ?? null,
      customer_email: customerEmail,
      customer_name: null,
      messages: chronological,
      last_message_at: latest.created_at ?? null,
      last_message_preview: cleanPreview(latest.body, 150),
      unread_count: unreadCount,
    };
  });

  return threads.sort(
    (a, b) => safeDate(b.last_message_at).getTime() - safeDate(a.last_message_at).getTime()
  );
}

function isAdminMessage(m: MessageRow) {
  const role = normalizeText(m.sender_role);
  return role === "admin" || role === "support";
}

/* ------------------------------- Page -------------------------------- */

export default function AdminSupportPage() {
  const queryClient = useQueryClient();

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [search, setSearch] = useState("");

  const {
    data: messages = [],
    isLoading,
    isFetching,
    error,
  } = useAllMessages();

  useEffect(() => {
    const ch = supabaseClient
      .channel("admin-support-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin:support:messages"] });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(ch);
    };
  }, [queryClient]);

  const threads = useMemo(() => buildThreads(messages), [messages]);

  const unreadCount = useMemo(
    () => threads.reduce((sum, t) => sum + t.unread_count, 0),
    [threads]
  );

  const readCount = useMemo(
    () => threads.filter((t) => t.unread_count === 0).length,
    [threads]
  );

  const filteredThreads = useMemo(() => {
    const base =
      filter === "unread"
        ? threads.filter((t) => t.unread_count > 0)
        : filter === "read"
        ? threads.filter((t) => t.unread_count === 0)
        : threads;

    const q = normalizeText(search);
    if (!q) return base;

    return base.filter((t) => {
      const haystack = [
        t.customer_email,
        t.subject,
        t.last_message_preview,
        t.appointment_id,
        ...t.messages.map((m) => `${m.body} ${m.sender_email} ${m.recipient_email ?? ""}`),
      ]
        .map((v) => normalizeText(v))
        .join(" ");

      return haystack.includes(q);
    });
  }, [threads, filter, search]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return filteredThreads.find((t) => t.id === selectedThreadId)
      ?? threads.find((t) => t.id === selectedThreadId)
      ?? null;
  }, [filteredThreads, threads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId && filteredThreads.length > 0) {
      setSelectedThreadId(filteredThreads[0].id);
    }
  }, [filteredThreads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const stillExists = threads.some((t) => t.id === selectedThreadId);
    if (!stillExists) {
      setSelectedThreadId(filteredThreads[0]?.id ?? null);
      setReplyText("");
    }
  }, [threads, filteredThreads, selectedThreadId]);

  const markThreadReadMutation = useMutation({
    mutationFn: async (thread: ThreadRow) => {
      const unreadCustomerMessageIds = thread.messages
        .filter((m) => normalizeText(m.sender_role) === "customer" && !m.is_read)
        .map((m) => m.id);

      if (unreadCustomerMessageIds.length === 0) return;

      const { error } = await supabaseClient
        .from("messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", unreadCustomerMessageIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin:support:messages"] });
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async (payload: {
      recipient_email: string;
      subject: string | null;
      appointment_id: string | null;
      body: string;
    }) => {
      const { error } = await supabaseClient.from("messages").insert({
        sender_email: SUPPORT_EMAIL,
        sender_role: "admin",
        recipient_email: payload.recipient_email,
        message_type: "support",
        subject: payload.subject,
        body: payload.body,
        appointment_id: payload.appointment_id,
        is_read: true,
        read_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin:support:messages"] });
      setReplyText("");
    },
  });

  const handleSelectThread = (thread: ThreadRow) => {
    setSelectedThreadId(thread.id);
    if (thread.unread_count > 0) {
      markThreadReadMutation.mutate(thread);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedThread) return;

    sendReplyMutation.mutate({
      recipient_email: selectedThread.customer_email,
      subject: `Re: ${selectedThread.subject || "Support request"}`,
      body: replyText.trim(),
      appointment_id: selectedThread.appointment_id,
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(245,198,92,0.10),transparent_30%),linear-gradient(180deg,#07111f_0%,#0a1526_45%,#09111d_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_28%,transparent_72%,rgba(255,214,102,0.06))]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/10">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Glass Guardian Support
                </Badge>
                <Badge className="border border-sky-400/20 bg-sky-400/10 text-sky-200 hover:bg-sky-400/10">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  iMessage Supreme
                </Badge>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner shadow-black/20">
                  <MessageSquare className="h-7 w-7 text-amber-300" />
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                    Customer Support
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-white/70 md:text-base">
                    Threaded support conversations with a clean chat-style reply experience.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["admin:support:messages"],
                  })
                }
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden border border-white/10 bg-white/[0.05] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl border border-white/10 bg-white/10 p-2.5">
                  <Inbox className="h-5 w-5 text-sky-300" />
                </div>
                <Badge className="border border-sky-400/20 bg-sky-400/10 text-sky-200 hover:bg-sky-400/10">
                  Threads
                </Badge>
              </div>
              <p className="text-sm text-white/65">Total Conversations</p>
              <p className="mt-1 text-3xl font-semibold text-white">{threads.length}</p>
              <p className="mt-2 text-xs text-white/45">
                Grouped customer support conversations.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-amber-400/15 bg-[linear-gradient(180deg,rgba(255,194,77,0.10),rgba(255,255,255,0.05))] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2.5">
                  <Mail className="h-5 w-5 text-amber-300" />
                </div>
                <Badge className="border border-amber-400/25 bg-amber-400/10 text-amber-200 hover:bg-amber-400/10">
                  Needs Review
                </Badge>
              </div>
              <p className="text-sm text-white/65">Unread Customer Messages</p>
              <p className="mt-1 text-3xl font-semibold text-white">{unreadCount}</p>
              <p className="mt-2 text-xs text-white/45">
                Messages still waiting on support review.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.10),rgba(255,255,255,0.05))] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                </div>
                <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10">
                  Reviewed
                </Badge>
              </div>
              <p className="text-sm text-white/65">Read Threads</p>
              <p className="mt-1 text-3xl font-semibold text-white">{readCount}</p>
              <p className="mt-2 text-xs text-white/45">
                Threads with no unread customer messages.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border border-white/10 bg-white/[0.05] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={filter} onValueChange={(v: string) => setFilter(v as typeof filter)}>
                <TabsList className="h-auto flex-wrap border border-white/10 bg-white/5 p-1">
                  <TabsTrigger value="all" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    All Threads ({threads.length})
                  </TabsTrigger>
                  <TabsTrigger value="unread" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Unread ({threads.filter((t) => t.unread_count > 0).length})
                  </TabsTrigger>
                  <TabsTrigger value="read" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Reviewed ({threads.filter((t) => t.unread_count === 0).length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer, subject, message..."
                  className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/35"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4 xl:col-span-4">
            <Card className="border border-white/10 bg-white/[0.05] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <CardHeader className="border-b border-white/10 pb-4">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Mail className="h-5 w-5 text-amber-300" />
                  Conversation Queue
                </CardTitle>
              </CardHeader>

              <CardContent className="p-3">
                {isLoading ? (
                  <div className="flex min-h-[500px] items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-amber-300" />
                      <p className="text-sm text-white/65">Loading support inbox...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex min-h-[500px] items-center justify-center">
                    <div className="max-w-sm text-center">
                      <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-300" />
                      <h3 className="text-lg font-semibold text-white">Unable to load messages</h3>
                      <p className="mt-2 text-sm text-white/60">
                        There was a problem loading the support inbox. Try refreshing the page.
                      </p>
                    </div>
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <div className="flex min-h-[500px] items-center justify-center">
                    <div className="max-w-sm text-center">
                      <Inbox className="mx-auto mb-4 h-12 w-12 text-white/30" />
                      <h3 className="text-lg font-semibold text-white">No conversations found</h3>
                      <p className="mt-2 text-sm text-white/60">
                        Nothing matches your current filter or search query.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
                    {filteredThreads.map((thread) => {
                      const selected = selectedThread?.id === thread.id;
                      const unread = thread.unread_count > 0;

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => handleSelectThread(thread)}
                          className={[
                            "w-full rounded-2xl border text-left transition-all duration-200",
                            "shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
                            selected
                              ? "border-amber-400/40 bg-amber-400/10 ring-1 ring-amber-300/40"
                              : unread
                              ? "border-sky-400/20 bg-sky-400/10 hover:border-sky-300/30 hover:bg-sky-400/12"
                              : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
                          ].join(" ")}
                        >
                          <div className="p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                  {thread.customer_email}
                                </p>
                                <p className="mt-1 truncate text-sm text-white/65">
                                  {thread.subject || "Support request"}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {unread ? (
                                  <span className="inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-sky-400 px-2 py-1 text-[10px] font-bold text-slate-950">
                                    {thread.unread_count}
                                  </span>
                                ) : (
                                  <Badge className="border border-white/10 bg-white/5 text-white/60">
                                    Read
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <p className="mb-3 line-clamp-3 text-sm leading-6 text-white/70">
                              {thread.last_message_preview}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {format(safeDate(thread.last_message_at), "MMM d, h:mm a")}
                                </span>

                                {thread.appointment_id ? (
                                  <Badge className="border border-white/10 bg-white/5 text-white/70 hover:bg-white/5">
                                    Appt: {thread.appointment_id}
                                  </Badge>
                                ) : null}
                              </div>

                              <Badge className="border border-white/10 bg-black/20 text-white/70 hover:bg-black/20">
                                {thread.messages.length} msg{thread.messages.length === 1 ? "" : "s"}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 xl:col-span-8">
            {selectedThread ? (
              <Card className="border border-white/10 bg-white/[0.05] shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <CardHeader className="border-b border-white/10 pb-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-white">
                        <MessageSquare className="h-5 w-5 text-amber-300" />
                        {selectedThread.subject || "Support request"}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60">
                        <span className="inline-flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {selectedThread.customer_email}
                        </span>
                        {selectedThread.appointment_id ? (
                          <Badge className="border border-white/10 bg-white/5 text-white/75">
                            Appointment linked
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border border-sky-400/20 bg-sky-400/10 text-sky-200">
                        Chat Thread
                      </Badge>
                      {selectedThread.unread_count > 0 ? (
                        <Badge className="border border-amber-400/20 bg-amber-400/10 text-amber-200">
                          {selectedThread.unread_count} unread
                        </Badge>
                      ) : (
                        <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                          Up to date
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="flex min-h-[680px] flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6">
                      {selectedThread.messages.map((message, idx) => {
                        const mine = isAdminMessage(message);
                        const prev = selectedThread.messages[idx - 1];
                        const showTimeDivider =
                          idx === 0 ||
                          safeDate(message.created_at).getTime() - safeDate(prev?.created_at).getTime() > 1000 * 60 * 30;

                        return (
                          <React.Fragment key={message.id}>
                            {showTimeDivider && (
                              <div className="flex justify-center py-2">
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/50">
                                  {format(safeDate(message.created_at), "MMM d, yyyy • h:mm a")}
                                </div>
                              </div>
                            )}

                            <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[82%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                                <div className="mb-1 px-2 text-[11px] text-white/45">
                                  {mine ? "Glass Guardian Support" : message.sender_email}
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

                                <div className={`mt-1 flex items-center gap-1 px-2 text-[11px] text-white/35 ${mine ? "justify-end" : "justify-start"}`}>
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

                    <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] p-4 md:p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Send className="h-4 w-4 text-amber-300" />
                        <p className="text-sm font-semibold text-white">Reply in thread</p>
                      </div>

                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a polished, helpful response..."
                        rows={5}
                        className="mb-4 resize-none border-white/10 bg-black/20 text-white placeholder:text-white/35"
                      />

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-white/45">
                          Replying inside this conversation as <span className="text-white/70">{SUPPORT_EMAIL}</span>
                        </p>

                        <div className="flex flex-wrap justify-end gap-3">
                          <Button
                            variant="outline"
                            onClick={() => setReplyText("")}
                            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                          >
                            Clear
                          </Button>

                          <Button
                            onClick={handleSendReply}
                            disabled={!replyText.trim() || sendReplyMutation.isPending}
                            className="border border-sky-300/20 bg-sky-500 text-slate-950 hover:bg-sky-400"
                          >
                            {sendReplyMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Send Reply
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex min-h-[680px] items-center justify-center border border-dashed border-white/15 bg-white/[0.04] shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                    <MessageSquare className="h-10 w-10 text-white/35" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white">No Conversation Selected</h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/60">
                    Select a conversation from the left panel to open the chat thread.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}