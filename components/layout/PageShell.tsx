// components/layout/PageShell.tsx
"use client";

import * as React from "react";
import clsx from "clsx";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={clsx(
        "min-h-screen w-full px-4 py-6 md:px-8 md:py-10",
        "bg-slate-950 text-slate-50",
        className
      )}
    >
      <div className="w-full max-w-6xl mx-auto">{children}</div>
    </main>
  );
}