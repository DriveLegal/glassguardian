"use client";

import * as React from "react";
import { format } from "date-fns";

export type AppointmentPickerProps = {
  appointments: { id: string; service_type?: string | null; scheduled_date?: string | null; service_address?: string | null }[];
  value?: string;
  onChange: (id: string) => void;
};

export function AppointmentPicker({ appointments, value, onChange }: AppointmentPickerProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="apt" className="text-sm font-medium text-slate-700">Appointment</label>
      <select
        id="apt"
        className="w-full rounded-xl border px-3 py-2 text-sm bg-white/70 backdrop-blur shadow-sm"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select appointment —</option>
        {appointments.map((a) => (
          <option key={a.id} value={a.id}>
            #{String(a.id).slice(0, 8)} • {(a.service_type ?? "").replace(/_/g, " ")} •{" "}
            {a.scheduled_date ? format(new Date(a.scheduled_date), "MMM d, yyyy") : "TBD"}
          </option>
        ))}
      </select>
    </div>
  );
}