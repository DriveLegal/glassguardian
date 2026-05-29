"use client";

import * as React from "react";

/* tiny class combiner */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "block w-full min-h-[96px] rounded-xl border",
          "border-slate-700/80 bg-slate-950/80",
          "px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm",
          "outline-none transition-[border-color,box-shadow,background-color] duration-200",
          "focus:border-amber-300/55 focus:ring-2 focus:ring-amber-400/15",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "resize-y",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";