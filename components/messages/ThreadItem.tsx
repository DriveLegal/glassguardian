"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type ThreadItemProps = {
  title: string;                // counterpart email
  snippet?: string;             // last message body
  dateISO?: string;
  scopeBadge?: React.ReactNode; // “Appt #XXXX” or “General”
  active?: boolean;
  onClick?: () => void;
};

export function ThreadItem({
  title,
  snippet,
  dateISO,
  scopeBadge,
  active,
  onClick,
}: ThreadItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-xl border transition bg-white/60 backdrop-blur",
        active ? "border-blue-200 shadow-md" : "border-slate-200 hover:bg-white/80"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900 truncate">{title}</div>
        <div className="text-xs text-slate-500">
          {dateISO ? format(new Date(dateISO), "MMM d, h:mm a") : ""}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {scopeBadge}
        {snippet && <span className="text-slate-600 truncate">• {snippet}</span>}
      </div>
    </button>
  );
}