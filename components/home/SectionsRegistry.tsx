"use client";

import * as React from "react";

export type SectionHandle = { id: string; ref: React.RefObject<HTMLElement> };

const Ctx = React.createContext<{
  sections: SectionHandle[];
  register: (id: string, ref: React.RefObject<HTMLElement>) => void;
  unregister: (id: string) => void;
} | null>(null);

export function SectionsProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] = React.useState<SectionHandle[]>([]);

  const register = React.useCallback((id: string, ref: React.RefObject<HTMLElement>) => {
    setSections((prev) => {
      const found = prev.find((s) => s.id === id);
      if (found) return prev;
      const next = [...prev, { id, ref }];
      // keep DOM order if possible by sorting by element's y
      next.sort((a, b) => {
        const ay = a.ref.current?.getBoundingClientRect().top ?? 0;
        const by = b.ref.current?.getBoundingClientRect().top ?? 0;
        return ay - by;
      });
      return next;
    });
  }, []);

  const unregister = React.useCallback((id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return <Ctx.Provider value={{ sections, register, unregister }}>{children}</Ctx.Provider>;
}

export function useSections() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useSections must be used inside <SectionsProvider>");
  return ctx;
}