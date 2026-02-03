"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils"; // same helper as in other ui components

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    inset?: boolean;
  }
>(({ className, align = "center", sideOffset = 8, inset, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // Layout + shape
        "z-50 rounded-2xl border bg-slate-950/95 px-3 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.9)]",
        "backdrop-blur-2xl bg-clip-padding",
        // Border / chrome
        "border-slate-800/90",
        // Text
        "text-sm text-slate-100",
        // Tiny inner glow
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-slate-50/5 before:content-['']",
        inset && "mt-1",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };