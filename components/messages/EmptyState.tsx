"use client";

import * as React from "react";
import { Mail, MessageSquare } from "lucide-react";

export function EmptyState({
  icon = "mail",
  title,
  subtitle,
}: {
  icon?: "mail" | "message";
  title: string;
  subtitle?: string;
}) {
  const Icon = icon === "message" ? MessageSquare : Mail;
  return (
    <div className="py-12 text-center text-slate-600">
      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/70 backdrop-blur border border-slate-200 grid place-items-center shadow">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      {subtitle && <div className="text-sm text-slate-600 mt-1">{subtitle}</div>}
    </div>
  );
}