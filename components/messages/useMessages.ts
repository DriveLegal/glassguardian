"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import type { Message } from "./MessageBubble";

const SUPPORT_EMAIL = "support@glassguardian.com";

type UseMessagesOpts = {
  /** Limit to a given appointment thread (optional) */
  scopeAppointmentId?: string | null;
  /** The email of the current actor (user or admin/support) */
  currentUserEmail: string;
  /** Admin/support can read all; user only sees their messages */
  adminMode?: boolean;
  /** For admin: who you’re talking to (required to send to a specific customer) */
  counterpartEmail?: string | null;
  /** Optional: fetch cap for admin inbox */
  adminLimit?: number;
  /** Optional: override support inbox address for user -> support */
  supportInboxAddress?: string;
};

/* ---------------------------------------
   Thread helpers (for side-bar lists)
--------------------------------------- */
export type ThreadSummary = {
  key: string;   // `${scope}::${counterpartEmail}`
  last: Message;
  count: number;
};

function threadKey(m: Message, agentEmail: string) {
  const scope = m.appointment_id || "general";
  const counterpart =
    m.sender_email === agentEmail ? m.recipient_email : m.sender_email;
  return `${scope}::${counterpart}`;
}

function buildThreads(messages: Message[], agentEmail: string): ThreadSummary[] {
  const map = new Map<string, { last: Message; count: number }>();
  for (const m of messages) {
    const key = threadKey(m, agentEmail);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { last: m, count: 1 });
    } else {
      const prevTs = prev.last.created_at ? new Date(prev.last.created_at).getTime() : 0;
      const curTs = m.created_at ? new Date(m.created_at).getTime() : 0;
      map.set(key, { last: curTs >= prevTs ? m : prev.last, count: prev.count + 1 });
    }
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort(
      (a, b) =>
        (b.last.created_at ? new Date(b.last.created_at).getTime() : 0) -
        (a.last.created_at ? new Date(a.last.created_at).getTime() : 0)
    );
}

/* ---------------------------------------
   Hook
--------------------------------------- */
export function useMessages(opts: UseMessagesOpts) {
  const {
    scopeAppointmentId,
    currentUserEmail,
    adminMode = false,
    counterpartEmail = null,
    adminLimit = 500,
    supportInboxAddress = SUPPORT_EMAIL,
  } = opts;

  const queryClient = useQueryClient();

  // FETCH
  const { data: messages = [], isLoading } = useQuery({
    queryKey: [
      "messages",
      adminMode ? "admin" : "user",
      currentUserEmail,
      scopeAppointmentId || "all",
    ],
    enabled: !!currentUserEmail,
    queryFn: async () => {
      let q = supabaseClient
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (adminMode) {
        // Admin/support: read all (optionally constrain to an appointment)
        if (scopeAppointmentId) q = q.eq("appointment_id", scopeAppointmentId);
        q = q.limit(adminLimit);
      } else {
        // User: only messages they’re part of
        q = q.or(
          `sender_email.eq.${currentUserEmail},recipient_email.eq.${currentUserEmail}`
        );
        if (scopeAppointmentId) q = q.eq("appointment_id", scopeAppointmentId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    staleTime: 10_000,
  });

  // REALTIME INVALIDATE
  React.useEffect(() => {
    if (!currentUserEmail) return;
    const channel = supabaseClient
      .channel(`messages:${adminMode ? "admin" : "user"}:${currentUserEmail}:${scopeAppointmentId || "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as Message;

          if (adminMode) {
            // Admin sees all (respect optional appointment scope)
            const scopeOK = !scopeAppointmentId || row.appointment_id === scopeAppointmentId;
            if (scopeOK) {
              queryClient.invalidateQueries({
                queryKey: [
                  "messages",
                  "admin",
                  currentUserEmail,
                  scopeAppointmentId || "all",
                ],
              });
            }
          } else {
            // User: only if involved (and scope matches if set)
            const involved =
              row.sender_email === currentUserEmail ||
              row.recipient_email === currentUserEmail;
            const scopeOK = !scopeAppointmentId || row.appointment_id === scopeAppointmentId;
            if (involved && scopeOK) {
              queryClient.invalidateQueries({
                queryKey: [
                  "messages",
                  "user",
                  currentUserEmail,
                  scopeAppointmentId || "all",
                ],
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [currentUserEmail, adminMode, scopeAppointmentId, queryClient]);

  // SEND
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      subject?: string | null;
      body: string;
      appointment_id?: string | null;
      /** For admin: required to target a specific customer thread */
      recipient_email?: string | null;
    }) => {
      if (!currentUserEmail) throw new Error("Missing sender");

      const isAppt = !!(payload.appointment_id || scopeAppointmentId);
      const toEmail = adminMode
        ? (payload.recipient_email || counterpartEmail || supportInboxAddress) // admin can still blast support if needed
        : supportInboxAddress;

      const { error } = await supabaseClient.from("messages").insert({
        subject: payload.subject || null,
        body: payload.body,
        appointment_id: payload.appointment_id ?? scopeAppointmentId ?? null,
        sender_email: currentUserEmail,
        sender_role: adminMode ? "support" : "customer",
        recipient_email: toEmail,
        message_type: isAppt ? "appointment" : "support",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "messages",
          adminMode ? "admin" : "user",
          currentUserEmail,
          scopeAppointmentId || "all",
        ],
      });
    },
  });

  // THREAD SUMMARIES (for sidebar lists)
  const threads = React.useMemo<ThreadSummary[]>(
    () => buildThreads(messages, currentUserEmail),
    [messages, currentUserEmail]
  );

  return {
    messages,
    isLoading,
    send: sendMutation.mutate,
    isSending: sendMutation.isPending,
    threads,
    invalidate: () =>
      queryClient.invalidateQueries({
        queryKey: [
          "messages",
          adminMode ? "admin" : "user",
          currentUserEmail,
          scopeAppointmentId || "all",
        ],
      }),
  };
}