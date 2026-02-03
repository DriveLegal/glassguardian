"use client";

import * as React from "react";
import * as RSelect from "@radix-ui/react-select";
import { ChevronDown, ChevronUp, Check } from "lucide-react";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

/* Re-export root so your import { Select, ... } continues to work */
export const Select = RSelect.Root;

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof RSelect.Trigger>
>(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <RSelect.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-between gap-2",
        "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
        "shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        className
      )}
      {...props}
    >
      {children}
      <RSelect.Icon>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </RSelect.Icon>
    </RSelect.Trigger>
  );
});

export const SelectValue = RSelect.Value;

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RSelect.Content>
>(function SelectContent({ className, children, sideOffset = 6, ...props }, ref) {
  return (
    <RSelect.Portal>
      <RSelect.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg",
          className
        )}
        {...props}
      >
        <RSelect.ScrollUpButton className="flex items-center justify-center py-1 text-gray-500">
          <ChevronUp className="h-4 w-4" />
        </RSelect.ScrollUpButton>

        <RSelect.Viewport className="p-1">{children}</RSelect.Viewport>

        <RSelect.ScrollDownButton className="flex items-center justify-center py-1 text-gray-500">
          <ChevronDown className="h-4 w-4" />
        </RSelect.ScrollDownButton>
      </RSelect.Content>
    </RSelect.Portal>
  );
});

export const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RSelect.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <RSelect.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center",
        "rounded-sm px-2 py-2 text-sm outline-none",
        "focus:bg-blue-50 focus:text-blue-900",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="mr-6">{children}</span>
      <RSelect.ItemIndicator className="absolute right-2 inline-flex items-center">
        <Check className="h-4 w-4" />
      </RSelect.ItemIndicator>
    </RSelect.Item>
  );
});