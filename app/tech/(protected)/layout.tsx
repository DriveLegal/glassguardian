"use client";

// app/tech/(protected)/layout.tsx
//
// Wraps the protected tech dashboard in the ReactQueryProvider so that all
// child pages can use useMutation / useQuery.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, type ReactNode } from "react";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  // Create a stable QueryClient per-component-tree (avoids sharing state
  // across requests in concurrent Next.js rendering).
  const clientRef = useRef<QueryClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new QueryClient();
  }

  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
    </QueryClientProvider>
  );
}
