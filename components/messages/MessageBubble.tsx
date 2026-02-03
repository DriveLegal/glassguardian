"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type Message = {
  recipient_email: any;
  id: string;
  body: string;
  subject?: string | null;
  created_at?: string;
  sender_email: string;
  appointment_id?: string | null;
};

export type MessageBubbleProps = {
  msg: Message;
  mine: boolean;
};

export function MessageBubble({ msg, mine }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-2xl border-2 bg-white/70 backdrop-blur transition shadow",
        mine ? "ml-8 border-blue-200 ring-1 ring-blue-100 shadow-lg" : "mr-8 border-gray-200 ring-1 ring-gray-100"
      )}
    >
      <div className="flex items-start justify-between mb-1 gap-3">
        {msg.subject && (
          <div className="text-sm font-semibold text-slate-800 truncate">{msg.subject}</div>
        )}
        <div className="text-xs text-slate-500 shrink-0">
          {msg.created_at ? format(new Date(msg.created_at), "MMM d, h:mm a") : ""}
        </div>
      </div>
      <div className="text-slate-900 whitespace-pre-wrap leading-relaxed">{msg.body}</div>
    </div>
  );
}