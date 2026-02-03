"use client";

import { useState, useCallback } from "react";
import type { Suggestion, AssistantResponse } from "@/lib/assistantTypes";

type AssistantPayload = {
  techEmail?: string | null;
  todayJobs?: any[];
  allJobs?: any[];
  bookingLeads?: any[];
  invites?: any[];
  prompt?: string;
};

export default function useAssistant() {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSuggestions = useCallback(
    async (payload: AssistantPayload) => {
      setLoading(true);
      setError(null);
      setSuggestions(null);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const t = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          setError(t?.error || `API error ${res.status}`);
          setLoading(false);
          return null;
        }

        const json = (await res.json()) as AssistantResponse;
        setSuggestions(json.suggestions ?? []);
        setLoading(false);
        return json.suggestions ?? [];
      } catch (e: any) {
        setError(e?.message || "Network error");
        setLoading(false);
        return null;
      }
    },
    []
  );

  const clear = useCallback(() => {
    setSuggestions(null);
    setError(null);
    setLoading(false);
  }, []);

  return { loading, suggestions, error, getSuggestions, clear };
}