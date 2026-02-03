"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";

type AnyObj = Record<string, any>;

function threadKey(m: AnyObj, agentEmail: string) {
  // Thread by (appointment_id || "general") + counterpart email
  const scope = m.appointment_id || "general";
  const counterpart =
    m.sender_email === agentEmail ? m.recipient_email : m.sender_email;
  return `${scope}::${counterpart}`;
}

export default function AdminMessagesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [agentEmail, setAgentEmail] = React.useState<string | null>(null);
  const [activeThread, setActiveThread] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "appointment" | "general">("all");
  const [compose, setCompose] = React.useState({ subject: "", body: "", appointment_id: "" });

  // Gate: must be admin/support
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      const email = session?.user?.email ?? null;
      const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role;
      if (!email || !role || !["admin", "support"].includes(String(role))) {
        router.replace("/login"); // or /admin/login
        return;
      }
      setAgentEmail(email);
    })();
  }, [router]);

  // Load all recent messages (support can read all)
  const { data: allMessages = [] } = useQuery({
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

  // Realtime invalidate
  React.useEffect(() => {
    if (!agentEmail) return;
    const ch = supabaseClient
      .channel("messages:admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin:messages"] });
      })
      .subscribe();
    return () => {
      supabaseClient.removeChannel(ch);
    };
  }, [agentEmail, queryClient]);

  // Build thread list
  const threads = React.useMemo(() => {
    const map = new Map<string, { last: AnyObj; count: number }>();
    for (const m of allMessages) {
      const key = threadKey(m, agentEmail || "");
      const prev = map.get(key);
      if (!prev || (m.created_at && prev.last.created_at && new Date(m.created_at) > new Date(prev.last.created_at))) {
        map.set(key, { last: m, count: (prev?.count || 0) + 1 });
      } else {
        map.set(key, { last: prev.last, count: (prev?.count || 0) + 1 });
      }
    }
    let arr = Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
    if (filter === "appointment") arr = arr.filter((t) => t.last.appointment_id);
    if (filter === "general") arr = arr.filter((t) => !t.last.appointment_id);
    return arr.sort((a, b) =>
      new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime()
    );
  }, [allMessages, agentEmail, filter]);

  // Messages for active thread
  const activeMessages = React.useMemo(() => {
    if (!activeThread) return [];
    return allMessages
      .filter((m: AnyObj) => threadKey(m, agentEmail || "") === activeThread)
      .sort((a: AnyObj, b: AnyObj) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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

  const sendMutation = useMutation({
    mutationFn: async (data: AnyObj) => {
      if (!agentEmail || !counterpartEmail) throw new Error("Missing addresses");
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
    },
  });

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
            <MessageSquare className="w-8 h-8 text-blue-600 drop-shadow-sm" />
            Support Inbox
          </h1>
          <p className="text-gray-600">View and reply to all customer conversations</p>
        </div>

        <Card className="mb-4 border border-white/60 bg-white/60 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-0">
              <TabsList className="bg-white/60 backdrop-blur rounded-xl shadow">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="appointment">Appointment</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid grid-cols-12 gap-6">
          {/* Thread list */}
          <Card className="col-span-12 lg:col-span-4 border border-white/60 bg-white/60 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {threads.length === 0 ? (
                <div className="text-sm text-gray-500 py-10 text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/70 backdrop-blur border border-slate-200 grid place-items-center shadow">
                    <Mail className="w-6 h-6 text-gray-400" />
                  </div>
                  No conversations yet
                </div>
              ) : (
                <div className="space-y-2">
                  {threads.map((t) => {
                    const m = t.last;
                    const isActive = activeThread === t.key;
                    const scopeBadge = m.appointment_id ? (
                      <Badge variant="secondary" className="text-[10px]">Appt #{String(m.appointment_id).slice(0,8)}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">General</Badge>
                    );
                    const party = m.sender_email === agentEmail ? m.recipient_email : m.sender_email;
                    return (
                      <button
                        key={t.key}
                        onClick={() => {
                          setActiveThread(t.key);
                          setCompose((c) => ({
                            ...c,
                            appointment_id: m.appointment_id || "",
                            subject: c.subject,
                          }));
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition bg-white/60 backdrop-blur ${
                          isActive ? "border-blue-200 shadow-md" : "border-slate-200 hover:bg-white/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-slate-900 truncate">{party}</div>
                          <div className="text-xs text-slate-500">
                            {m.created_at ? format(new Date(m.created_at), "MMM d, h:mm a") : ""}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          {scopeBadge}
                          {m.subject && <span className="text-slate-600 truncate">• {m.subject}</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-1">{m.body}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card className="col-span-12 lg:col-span-8 border border-white/60 bg-white/60 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Conversation
                {appointmentIdForThread ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Appt #{String(appointmentIdForThread).slice(0, 8)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">General</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!activeThread ? (
                <div className="text-sm text-gray-500 py-10 text-center">
                  Select a conversation from the left
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto pr-1 rounded-2xl bg-gradient-to-b from-white/50 to-white/30 p-3">
                    {activeMessages.map((m: AnyObj) => {
                      const mine = m.sender_email === agentEmail;
                      return (
                        <div
                          key={m.id}
                          className={`p-4 rounded-2xl border-2 ${
                            mine ? "bg-white/70 backdrop-blur border-blue-200 ring-1 ring-blue-100 ml-8 shadow-lg" : "bg-white/70 backdrop-blur border-gray-200 ring-1 ring-gray-100 mr-8 shadow"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-semibold text-gray-900">
                              {mine ? "You" : m.sender_email}
                            </div>
                            <div className="text-xs text-gray-500">
                              {m.created_at ? format(new Date(m.created_at), "MMM d, h:mm a") : ""}
                            </div>
                          </div>
                          {m.subject && <div className="text-sm font-medium text-gray-700">{m.subject}</div>}
                          <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">{m.body}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Composer */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!compose.body.trim()) return;
                      sendMutation.mutate({
                        subject: compose.subject || null,
                        body: compose.body,
                        appointment_id: appointmentIdForThread || compose.appointment_id || null,
                      });
                    }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Input
                          placeholder="Subject (optional)"
                          value={compose.subject}
                          onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                          className="bg-white/70 backdrop-blur border-slate-200 shadow-sm"
                        />
                      </div>
                      <Textarea
                        placeholder="Type a reply…"
                        rows={4}
                        value={compose.body}
                        onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                        className="bg-white/70 backdrop-blur border-slate-200 shadow-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        {appointmentIdForThread ? (
                          <Badge variant="secondary">Appointment thread</Badge>
                        ) : (
                          <Badge variant="outline">General support</Badge>
                        )}
                      </div>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700 shadow-lg" disabled={sendMutation.isPending}>
                        {sendMutation.isPending ? "Sending..." : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}