// components/ui/alert.tsx
"use client";

import * as React from "react";

/* tiny cn helper */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

type Variant = "default" | "info" | "success" | "warning" | "destructive";

const base =
  "w-full rounded-lg border p-4 text-sm flex items-start gap-3";
const variants: Record<Variant, string> = {
  default: "bg-white border-gray-200 text-gray-800",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  destructive: "bg-red-50 border-red-200 text-red-900",
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

/** Container */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, variant = "default", ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(base, variants[variant], className)}
      {...props}
    />
  );
});

/** Optional title (bold, slightly larger) */
export const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function AlertTitle({ className, ...props }, ref) {
  return (
    <h5
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
});

/** Description/content */
export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function AlertDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn("text-sm leading-relaxed", className)}
      {...props}
    />
  );
});

export default Alert;