"use client";

import * as React from "react";
import * as RSwitch from "@radix-ui/react-switch";

function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof RSwitch.Root> {}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch({ className, ...props }, ref) {
    return (
      <RSwitch.Root
        ref={ref}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
          "border border-gray-300 bg-gray-200 transition-colors",
          "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          className
        )}
        {...props}
      >
        <RSwitch.Thumb
          className={cn(
            "pointer-events-none block h-5 w-5 translate-x-0 rounded-full bg-white shadow transition-transform",
            "data-[state=checked]:translate-x-5"
          )}
        />
      </RSwitch.Root>
    );
  }
);