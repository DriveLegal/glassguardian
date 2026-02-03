"use client";

import * as React from "react";

/* tiny class combiner */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

type BadgeVariant =
  | "solid"
  | "outline"
  | "secondary"
  | "destructive"
  | "success"
  | "warning";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant = "solid", ...props },
  ref
) {
  const base =
    "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";

  const variants: Record<BadgeVariant, string> = {
    solid: "border border-gray-200 bg-gray-100 text-gray-800",
    outline: "border border-gray-300 text-gray-800 bg-transparent",
    secondary: "border border-slate-200 bg-slate-100 text-slate-800",
    destructive: "border border-red-200 bg-red-100 text-red-800",
    success: "border border-emerald-200 bg-emerald-100 text-emerald-800",
    warning: "border border-yellow-200 bg-yellow-100 text-yellow-800",
  };

  return (
    <span
      ref={ref}
      className={cn(base, variants[variant] ?? variants.solid, className)}
      {...props}
    />
  );
});