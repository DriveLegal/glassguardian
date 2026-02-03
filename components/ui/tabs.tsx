// components/ui/tabs.tsx
"use client";

import * as React from "react";
import * as RTabs from "@radix-ui/react-tabs";

/* tiny cn helper (avoid importing your utils) */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

/* Root element */
export const Tabs = RTabs.Root;

/* List container */
export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RTabs.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <RTabs.List
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-gray-100 p-1",
        "shadow-inner border border-gray-200/70 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
});

/* Individual tab trigger */
export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof RTabs.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <RTabs.Trigger
      ref={ref}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150",
        "data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm",
        "data-[state=inactive]:text-gray-600 hover:text-gray-900 hover:bg-white/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

/* Content panel (this fixes your TS error) */
export const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RTabs.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <RTabs.Content
      ref={ref}
      className={cn(
        "mt-4 rounded-lg border border-gray-200/60 bg-white/95 p-4 shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
        className
      )}
      {...props}
    />
  );
});