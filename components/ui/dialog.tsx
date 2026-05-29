// components/ui/dialog.tsx
"use client";

import * as React from "react";
import * as RDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/** tiny class combiner */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

/* Root & Trigger so existing imports keep working */
export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

/* Overlay: darker + more solid so page aurora cannot bleed through */
export const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RDialog.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <RDialog.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-[#020617]/88",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  );
});

/* Content: dark premium panel + gold magnetic glow */
export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RDialog.Content> & { maxWidthClass?: string }
>(function DialogContent(
  { className, children, maxWidthClass = "max-w-2xl", ...props },
  ref
) {
  return (
    <RDialog.Portal>
      <DialogOverlay />
      <RDialog.Content
        ref={ref}
        className={cn(
          "fixed z-[60] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] sm:w-full",
          maxWidthClass,
          "overflow-hidden rounded-2xl p-0 outline-none",
          "border border-amber-300/18",
          "bg-[linear-gradient(180deg,rgba(4,7,14,0.995),rgba(2,6,12,0.992))]",
          "text-slate-100",
          "shadow-[0_50px_140px_rgba(0,0,0,0.72),0_0_0_1px_rgba(251,191,36,0.05)]",
          "outline outline-1 outline-white/[0.04]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[state=open]:slide-in-from-top-[8px] data-[state=closed]:slide-out-to-top-[2%]",
          className
        )}
        {...props}
      >
        {/* top magnetic lock line */}
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />

        {/* magnetic gold glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-20 w-[34rem] -translate-x-1/2 bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_68%)] blur-2xl" />

        {/* subtle gold surface aura */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background:
              "radial-gradient(1200px 380px at 50% -18%, rgba(251,191,36,0.13), transparent 52%)",
          }}
        />

        {/* soft inner sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-[inherit]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.08), transparent 16%, transparent 82%, rgba(251,191,36,0.03))",
          }}
        />

        {/* inner body */}
        <div className="relative rounded-2xl p-6">
          {children}
        </div>

        {/* optional close button */}
        <RDialog.Close
          className={cn(
            "absolute right-4 top-4 rounded-md p-1.5",
            "text-slate-400 hover:text-slate-100",
            "transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-amber-400/30"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </RDialog.Close>
      </RDialog.Content>
    </RDialog.Portal>
  );
});

/* Header / Title / Description / Footer */
export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-3 flex flex-col gap-1.5 text-center sm:text-left", className)}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof RDialog.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <RDialog.Title
      ref={ref}
      className={cn("text-xl font-semibold tracking-tight text-slate-50", className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof RDialog.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <RDialog.Description
      ref={ref}
      className={cn("text-sm text-slate-400", className)}
      {...props}
    />
  );
});

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}