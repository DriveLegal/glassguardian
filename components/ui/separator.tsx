"use client";

import * as React from "react";

/* tiny cn helper */
function cn(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  /** "horizontal" (default) or "vertical" */
  orientation?: "horizontal" | "vertical";
  /** If true, renders with ARIA role="none" for decorative use */
  decorative?: boolean;
};

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  function Separator(
    { className, orientation = "horizontal", decorative = false, ...props },
    ref
  ) {
    const horizontal = orientation === "horizontal";

    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={orientation}
        className={cn(
          "shrink-0 bg-slate-200 dark:bg-slate-700",
          horizontal ? "h-px w-full" : "h-full w-px",
          className
        )}
        {...props}
      />
    );
  }
);

export default Separator;