// components/ui/dialog.tsx
"use client";

import * as React from "react";
import * as RDialog from "@radix-ui/react-dialog";

/** tiny class combiner */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

/* Root & Trigger so existing imports keep working */
export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

/* Overlay with soft blur + fade */
export const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RDialog.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <RDialog.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  );
});

/* Content with glassmorphism + conic micro-glow ring */
export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RDialog.Content> & { maxWidthClass?: string }
>(function DialogContent({ className, children, maxWidthClass = "max-w-2xl", ...props }, ref) {
  return (
    <RDialog.Portal>
      <DialogOverlay />
      <RDialog.Content
        ref={ref}
        className={cn(
          "fixed z-[60] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full", // center
          maxWidthClass,
          "rounded-2xl p-0 outline-none",
          // glass card
          "border border-white/30 bg-white/70 backdrop-blur-xl",
          "shadow-[0_30px_80px_rgba(2,6,23,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]",
          // entrance
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {/* conic highlight ring */}
        <div className="pointer-events-none absolute -inset-[1.2px] rounded-2xl opacity-70 blur-[1.5px]"
             style={{ background: "conic-gradient(from 160deg at 50% 50%, #60a5fa, transparent 22%, #34d399 48%, transparent 76%, #a78bfa 100%)" }} />
        {/* inner body */}
        <div className="relative rounded-2xl p-6">
          {children}
        </div>
      </RDialog.Content>
    </RDialog.Portal>
  );
});

/* Header / Title / Description / Footer */
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex flex-col gap-1.5 text-center sm:text-left", className)} {...props} />
  );
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof RDialog.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <RDialog.Title
      ref={ref}
      className={cn("text-xl font-semibold tracking-tight text-slate-900", className)}
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
      className={cn("text-sm text-slate-600", className)}
      {...props}
    />
  );
});

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2", className)} {...props} />
  );
}