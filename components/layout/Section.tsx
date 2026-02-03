// components/layout/Section.tsx
import * as React from "react";
import clsx from "clsx";

type SectionProps = {
  children: React.ReactNode;
  className?: string;
};

export function Section({ children, className }: SectionProps) {
  return (
    <section className={clsx("w-full space-y-3 md:space-y-4", className)}>
      {children}
    </section>
  );
}