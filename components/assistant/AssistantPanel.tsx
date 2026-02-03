"use client";

import * as React from "react";
import useAssistant from "@/hooks/useAssistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardCopy, RefreshCw, Wand2 } from "lucide-react";
import type { AssistantAction } from "@/lib/assistantTypes";

export default function AssistantPanel({
  techEmail,
  todayJobs,
  allJobs,
  bookingLeads,
  invites,
}: {
  techEmail?: string | null;
  todayJobs?: any[];
  allJobs?: any[];
  bookingLeads?: any[];
  invites?: any[];
}) {
  const { loading, suggestions, error, getSuggestions, clear } = useAssistant();
  const [prompt, setPrompt] = React.useState<string>(
    "Give me prioritized actions for my route"
  );
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // initial auto-fetch when panel mounts
  React.useEffect(() => {
    getSuggestions({
      techEmail,
      todayJobs,
      allJobs,
      bookingLeads,
      invites,
      prompt: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  }

  const isOfflineFallback = suggestions?.some(
    (s) => s.id === "local-offline-info"
  );

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-sky-500/20 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-sky-300" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">
              Tech Assistant
            </h4>
            <p className="text-[11px] text-slate-400">
              Smart suggestions for jobs, leads & invites.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOfflineFallback && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100">
              Offline mode
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              getSuggestions({
                techEmail,
                todayJobs,
                allJobs,
                bookingLeads,
                invites,
                prompt,
              })
            }
            disabled={loading}
            className="h-8 px-2 text-xs text-slate-200 hover:text-slate-50"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the assistant something..."
          className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500"
        />
        <Button
          onClick={() =>
            getSuggestions({
              techEmail,
              todayJobs,
              allJobs,
              bookingLeads,
              invites,
              prompt,
            })
          }
          disabled={loading}
          className="whitespace-nowrap"
        >
          Ask
        </Button>
      </div>

      {loading && (
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          Thinking…
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-700/60 rounded-md px-2 py-1">
          {error}
        </div>
      )}

      {/* Suggestions grid (less vertical, more horizontal) */}
      {suggestions && suggestions.length > 0 && (
        <div className="max-h-72 md:max-h-60 overflow-y-auto pr-1">
          <div className="grid gap-2 md:grid-cols-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="bg-slate-800/60 rounded-xl border border-slate-700/80 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm text-slate-100 leading-snug">
                    {s.text}
                  </div>
                  <button
                    onClick={() => handleCopy(s.text, s.id)}
                    title="Copy"
                    className="text-slate-400 hover:text-slate-100 shrink-0"
                  >
                    <ClipboardCopy className="w-4 h-4" />
                  </button>
                </div>

                {s.actions && s.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.actions.map((a, i) => (
                      <ActionButton key={`${s.id}-${i}`} action={a} />
                    ))}
                  </div>
                )}

                {copiedId === s.id && (
                  <div className="mt-1 text-[10px] text-slate-400">
                    Copied.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && (!suggestions || suggestions.length === 0) && (
        <div className="text-xs text-slate-400">
          No suggestions yet. Ask a question or refresh to get an action plan.
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-[10px] text-slate-500">
          Suggestions are hints only; always follow company policy and your
          judgment.
        </div>
        <Button size="sm" variant="outline" onClick={() => clear()}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function ActionButton({ action }: { action: AssistantAction }) {
  const onRun = () => {
    if (!action) return;

    if (action.type === "navigate" && action.payload?.jobId) {
      window.location.href = `/tech/dashboard/schedule/jobs/${action.payload.jobId}`;
      return;
    }

    if (action.type === "advance_job_status" && action.payload?.jobId) {
      // Future: wire to a real mutation
      alert(
        `Ask: advance job ${action.payload.jobId} to status "${
          action.payload.nextStatus ?? "next"
        }".`
      );
      return;
    }

    if (action.type === "open_leads") {
      alert("Open your leads section to contact high-priority leads.");
      return;
    }

    if (action.type === "view_invites") {
      alert("Open your user invites to follow up on pending accounts.");
      return;
    }

    if (action.type === "create_user" && action.payload?.email) {
      alert(
        `Create user suggested: ${action.payload.email}${
          action.payload.name ? ` (${action.payload.name})` : ""
        }`
      );
      return;
    }

    alert(`Action: ${action.type}`);
  };

  return (
    <button
      onClick={onRun}
      className="rounded-full bg-sky-600/90 px-3 py-1 text-[11px] text-white hover:bg-sky-500 transition"
    >
      {action.label ?? action.type}
    </button>
  );
}