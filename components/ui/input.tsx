"use client";

import * as React from "react";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          // 🔥 DARK THEME DEFAULTS (no more white boxes!)
          "block w-full rounded-md border border-slate-700 bg-slate-900/80",
          "px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500",

          // 🔥 Beautiful consistent focus ring
          "shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500",

          // 🔥 Disabled behavior
          "disabled:cursor-not-allowed disabled:opacity-50",

          className
        )}
        {...props}
      />
    );
  }
);