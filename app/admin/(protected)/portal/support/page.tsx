// app/admin/support/page.tsx
"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  MessageSquare,
  Send,
  Mail,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

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

const SUPPORT_EMAIL = "support@glassguardian.com";

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
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as MessageRow[];
    },
    staleTime: 10_000,
  });
}

/* ------------------------------- Page -------------------------------- */
export default function AdminSupportPage() {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<MessageRow | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const { data: messages = [] } = useAllMessages();

  // Realtime: invalidate when new/updated messages arrive
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

  const unreadCount = useMemo(
    () => messages.filter((m) => !m.is_read).length,
    [messages]
  );

  const filteredMessages = useMemo(() => {
    if (filter === "unread") return messages.filter((m) => !m.is_read);
    if (filter === "read") return messages.filter((m) => !!m.is_read);
    return messages;
  }, [messages, filter]);

  /* ---------------------------- Mutations ---------------------------- */
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseClient
        .from("messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin:support:messages"] });
      setReplyText("");
      setSelectedMessage(null);
    },
  });

  /* --------------------------- Handlers ------------------------------ */
  const handleSelectMessage = (msg: MessageRow) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      markReadMutation.mutate(msg.id);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedMessage) return;
    sendReplyMutation.mutate({
      recipient_email: selectedMessage.sender_email,
      subject: `Re: ${selectedMessage.subject || "Your inquiry"}`,
      body: replyText.trim(),
      appointment_id: selectedMessage.appointment_id,
    });
  };

  /* ------------------------------ UI -------------------------------- */
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            Customer Support
          </h1>
          <p className="text-gray-600 mt-1">Manage customer inquiries and messages</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Total Messages</p>
              <p className="text-3xl font-bold">{messages.length}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Unread</p>
              <p className="text-3xl font-bold">{unreadCount}</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Responded</p>
              <p className="text-3xl font-bold">{messages.filter((m) => m.is_read).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-none shadow-lg">
          <CardContent className="p-6">
            <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
              <TabsList>
                <TabsTrigger value="all">All Messages ({messages.length})</TabsTrigger>
                <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
                <TabsTrigger value="read">
                  Responded ({messages.filter((m) => m.is_read).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Messages list */}
          <div className="lg:col-span-1 space-y-3">
            {filteredMessages.map((message) => (
              <Card
                key={message.id}
                className={`border-none shadow-lg cursor-pointer transition-all ${
                  selectedMessage?.id === message.id
                    ? "ring-2 ring-blue-500"
                    : !message.is_read
                    ? "bg-blue-50"
                    : ""
                }`}
                onClick={() => handleSelectMessage(message)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1 truncate">
                        {message.sender_email}
                      </p>
                      {message.subject && (
                        <p className="text-sm font-medium text-gray-700 mb-1 truncate">
                          {message.subject}
                        </p>
                      )}
                    </div>
                    {!message.is_read && (
                      <Badge className="bg-orange-500 text-white">New</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">{message.body}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(
                      new Date(message.created_at ?? Date.now()),
                      "MMM d, h:mm a"
                    )}
                  </p>
                </CardContent>
              </Card>
            ))}

            {filteredMessages.length === 0 && (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="py-12 text-center">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600">No messages found</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Detail + Reply */}
          <div className="lg:col-span-2">
            {selectedMessage ? (
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Message Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {selectedMessage.sender_email}
                        </p>
                        {selectedMessage.subject && (
                          <p className="text-sm text-gray-600">
                            Subject: {selectedMessage.subject}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(
                          new Date(selectedMessage.created_at ?? Date.now()),
                          "MMM d, yyyy h:mm a"
                        )}
                      </p>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedMessage.body}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Reply
                    </label>
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your response here..."
                      rows={6}
                      className="mb-3"
                    />
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setSelectedMessage(null)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || sendReplyMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {sendReplyMutation.isPending ? (
                          "Sending..."
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Reply
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-dashed border-gray-300 h-full flex items-center justify-center">
                <CardContent className="py-16 text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No Message Selected
                  </h3>
                  <p className="text-gray-600">
                    Select a message from the list to view and respond
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