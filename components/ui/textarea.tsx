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
          "block w-full rounded-md border border-gray-300 bg-white",
          "px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400",
          "shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "resize-vertical",
          className
        )}
        {...props}
      />
    );
  }
);