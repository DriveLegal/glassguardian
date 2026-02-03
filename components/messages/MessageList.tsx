"use client";

import * as React from "react";
import { MessageBubble } from "./MessageBubble";

export type Message = {
  id: string;
  body: string;
  subject?: string | null;
  created_at?: string;
  sender_email: string;
  recipient_email?: string | null; // ✅ make it optional on input
  appointment_id?: string | null;
};

export type MessageListProps = {
  messages: Message[];
  currentUserEmail: string;
};

export function MessageList({ messages, currentUserEmail }: MessageListProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div
      ref={ref}
      className="max-h-[50vh] overflow-y-auto pr-1 space-y-4 rounded-2xl bg-gradient-to-b from-white/50 to-white/30 p-3"
    >
      {messages.map((m) => {
        // ✅ Ensure required field exists for MessageBubble
        const recipient = m.recipient_email ?? (m.sender_email === currentUserEmail ? "" : currentUserEmail);
        const msgForBubble = { ...m, recipient_email: recipient } as Required<Pick<Message, "recipient_email">> & Message;

        return (
          <MessageBubble
            key={m.id}
            msg={msgForBubble}
            mine={m.sender_email === currentUserEmail}
          />
        );
      })}
    </div>
  );
}