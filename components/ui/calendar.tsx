// components/ui/calendar.tsx
"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-3 text-sm rounded-2xl bg-slate-950/95 border border-slate-800 shadow-[0_20px_50px_rgba(15,23,42,0.9)]",
        className
      )}
      classNames={{
        // layout
        months:
          "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption:
          "flex justify-center pt-1 relative items-center text-slate-50",
        caption_label: "text-sm font-semibold tracking-wide",
        nav: "space-x-1 flex items-center",

        // nav buttons – we attach a known class so CSS can target it
        nav_button:
          "rdp-nav_button inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70",

        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",

        // table
        table: "w-full border-collapse space-y-1 text-slate-50",
        head_row: "flex",
        head_cell:
          "w-9 text-[0.7rem] font-medium text-slate-400 text-center",
        row: "flex w-full mt-1",
        cell: "relative text-center text-sm h-9 w-9",

        // days
        day: "h-9 w-9 rounded-md p-0 font-normal border border-transparent aria-selected:opacity-100 hover:border-sky-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70",
        day_selected:
          "bg-sky-600 text-white hover:bg-sky-600 hover:text-white",
        day_today: "bg-slate-800 text-slate-50",
        day_outside: "text-slate-500 opacity-60",
        day_disabled: "text-slate-600 opacity-40",
        day_range_middle: "bg-sky-600/30 text-slate-50",
        day_hidden: "invisible",

        ...classNames,
      }}
      {...props}
    />
  );
}