"use client";

import * as React from "react";
import { ThreadItem } from "./ThreadItem";

export type Message = {
  id: string;
  body: string;
  subject?: string | null;
  created_at?: string;
  sender_email: string;
  appointment_id?: string | null;
};

export type ThreadSummary = {
  key: string;
  last: Message;
  count: number;
};

export type ThreadListProps = {
  threads: ThreadSummary[];
  activeKey?: string | null;
  onSelect: (key: string) => void;
  filter: "all" | "appointment" | "general";
  onFilterChange: (f: "all" | "appointment" | "general") => void;
};

export function ThreadList({
  threads,
  activeKey,
  onSelect,
}: ThreadListProps) {
  return (
    <div className="space-y-2">
      {threads.map((t) => (
        <ThreadItem
          key={t.key}
          title={
            // infer counterpart display from last message if needed
            // caller can also preformat a nicer title
            (t.last as any).sender_email
          }
          snippet={t.last.body}
          dateISO={t.last.created_at}
          scopeBadge={
            t.last.appointment_id ? (
              <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] border-slate-200 bg-white/70 backdrop-blur">
                Appt #{String(t.last.appointment_id).slice(0, 8)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] border-slate-200 bg-white/70 backdrop-blur">
                General
              </span>
            )
          }
          active={activeKey === t.key}
          onClick={() => onSelect(t.key)}
        />
      ))}
    </div>
  );
}