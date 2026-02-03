// app/api/assistant/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AssistantRequest = {
  techEmail?: string | null;
  todayJobs?: any[];
  allJobs?: any[];
  bookingLeads?: any[];
  invites?: any[];
  prompt?: string;
};

export type AssistantAction = {
  type: string;
  label?: string;
  payload?: any;
};

export type Suggestion = {
  id: string;
  text: string;
  score?: number;
  actions?: AssistantAction[];
};

export type AssistantResponse = {
  suggestions: Suggestion[];
  raw?: any;
};

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin Supabase client for RAG + secure access (do NOT expose this key to the client)
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isOpenStatus(status: any) {
  const s = String(status ?? "").toLowerCase();
  return !["completed", "paid", "cancelled"].includes(s);
}

// Safely call OpenAI chat – returns a descriptive error on quota issues
async function callOpenAIChat(messages: any[]): Promise<string> {
  if (!OPENAI_KEY) throw new Error("Missing OPENAI_API_KEY in env");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.2,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("OpenAI error", res.status, text);

    try {
      const parsed = JSON.parse(text);
      const msg = parsed?.error?.message as string | undefined;
      if (msg) throw new Error(msg);
    } catch {
      // ignore JSON parse issues, fall through
    }

    throw new Error("LLM provider error");
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

// Helper: embed query text using OpenAI embeddings for RAG
async function embedText(text: string): Promise<number[] | null> {
  if (!OPENAI_KEY) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!res.ok) {
    console.error("Embeddings error", res.status, await res.text());
    return null;
  }

  const json = await res.json();
  const vec = json?.data?.[0]?.embedding;
  return Array.isArray(vec) ? (vec as number[]) : null;
}

// Helper: RAG lookup (optional, best-effort)
async function fetchRagContext(opts: {
  techEmail?: string | null;
  basePrompt: string;
}) {
  if (!supabaseAdmin) return [];

  const embedding = await embedText(opts.basePrompt);
  if (!embedding) return [];

  const { data, error } = await supabaseAdmin.rpc("match_tech_knowledge", {
    query_embedding: embedding,
    match_count: 5,
    tech_email: opts.techEmail ?? null,
  });

  if (error) {
    console.error("RAG rpc error", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    similarity: row.similarity,
  }));
}

// Helper: compact summaries so we never dump giant JSON to the LLM
function summarize(label: string, items?: any[]) {
  if (!items || items.length === 0) return `${label}: 0`;

  const sample = items.slice(0, 4).map((it) => {
    const id = it.id ?? it.job_id ?? it.code ?? "";
    const type = it.service_type ?? it.lead_type ?? it.coverage_type ?? "";
    const addr =
      it.service_address ??
      it.address ??
      it.customer_email ??
      it.email ??
      "";
    const status = it.status ?? "";
    return `(${id}) ${type} ${status} ${String(addr).slice(0, 60)}`;
  });

  return `${label}: total=${items.length} — examples: ${sample.join(" | ")}`;
}

/* -------------------------------------------------------------------------- */
/* Offline "Jarvis" – smart deterministic fallback                             */
/* -------------------------------------------------------------------------- */

function buildFallbackResponse(
  body: AssistantRequest,
  reason: string
): AssistantResponse {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const prompt = (body.prompt ?? "").toLowerCase();

  const allJobs = (body.allJobs ?? []) as any[];
  const todayJobs = (body.todayJobs ?? []) as any[];
  const bookingLeads = (body.bookingLeads ?? []) as any[];
  const invites = (body.invites ?? []) as any[];

  // Normalize + sort jobs
  const withDate = (jobs: any[]) =>
    jobs.filter((j) => !!j && !!j.scheduled_date && typeof j.scheduled_date === "string");

  const overdue = withDate(allJobs).filter(
    (j) => isOpenStatus(j.status) && j.scheduled_date < todayStr
  );
  const activeToday = withDate(allJobs).filter(
    (j) => isOpenStatus(j.status) && j.scheduled_date === todayStr
  );
  const upcoming = withDate(allJobs).filter(
    (j) => isOpenStatus(j.status) && j.scheduled_date > todayStr
  );

  overdue.sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)));
  activeToday.sort((a, b) =>
    String(a.scheduled_time_start ?? "").localeCompare(
      String(b.scheduled_time_start ?? "")
    )
  );
  upcoming.sort((a, b) => {
    const d = String(a.scheduled_date).localeCompare(String(b.scheduled_date));
    if (d !== 0) return d;
    return String(a.scheduled_time_start ?? "").localeCompare(
      String(b.scheduled_time_start ?? "")
    );
  });

  // Leads: newest first
  const leadsSorted = [...bookingLeads].sort((a: any, b: any) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  );
  // Invites: pending first, oldest first
  const pendingInvites = invites.filter((i: any) => !i.used_at);
  pendingInvites.sort((a: any, b: any) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  );

  const suggestions: Suggestion[] = [];

  const firstOverdue = overdue[0];
  const firstActive = activeToday[0];
  const firstUpcoming = upcoming[0];
  const topLead = leadsSorted[0];

  const totalOpenToday = todayJobs.filter((j: any) => isOpenStatus(j.status))
    .length;
  const totalOpen = allJobs.filter((j: any) => isOpenStatus(j.status)).length;

  /* ---- 0. If the prompt asks for something specific, bias the first tip ---- */

  const wantsLeads =
    prompt.includes("lead") || prompt.includes("call") || prompt.includes("contact");
  const wantsSchedule =
    prompt.includes("schedule") ||
    prompt.includes("route") ||
    prompt.includes("optimize") ||
    prompt.includes("jobs");
  const wantsInvites =
    prompt.includes("invite") || prompt.includes("user") || prompt.includes("account");

  if (wantsLeads && topLead) {
    const email =
      topLead.customer_email ||
      topLead.email ||
      topLead.contact_email ||
      "this lead";
    suggestions.push({
      id: "local-focus-leads",
      text: `Focus on converting leads first: call or text your top open lead (${email}) and aim to turn it into a scheduled job in the next available slot.`,
      actions: [
        {
          type: "open_leads",
          label: "Open leads",
          payload: {},
        },
      ],
    });
  }

  if (wantsSchedule && (firstOverdue || firstActive || firstUpcoming)) {
    suggestions.push({
      id: "local-focus-schedule",
      text:
        "Scan your route for overdue or tightly stacked jobs, adjust any risky overlaps, and lock in the next two stops so you’re never improvising on the drive.",
      actions: [
        firstActive?.id && {
          type: "navigate",
          label: "Open current job",
          payload: { jobId: firstActive.id },
        },
        firstUpcoming?.id && {
          type: "navigate",
          label: "Open next job",
          payload: { jobId: firstUpcoming.id },
        },
      ].filter(Boolean) as AssistantAction[],
    });
  }

  if (wantsInvites && pendingInvites.length > 0) {
    suggestions.push({
      id: "local-focus-invites",
      text:
        "Nudge customers with pending invites so they finish account setup and can see their warranties and invoices without calling support.",
      actions: [
        {
          type: "view_invites",
          label: "View pending invites",
          payload: {},
        },
      ],
    });
  }

  /* ---- 1. Overdue jobs (highest risk) ------------------------------------- */

  if (firstOverdue) {
    const addr =
      firstOverdue.service_address ||
      firstOverdue.address ||
      firstOverdue.customer_email ||
      "the overdue job";
    suggestions.push({
      id: "local-overdue",
      text: `Handle overdue work first: review your oldest open job before today and decide whether to complete, reschedule, or clearly mark it as cancelled so it stops cluttering your pipeline. Example: ${String(
        addr
      ).slice(0, 80)}.`,
      actions: [
        firstOverdue.id && {
          type: "navigate",
          label: "Open oldest overdue job",
          payload: { jobId: firstOverdue.id },
        },
      ].filter(Boolean) as AssistantAction[],
    });
  }

  /* ---- 2. Today’s active jobs --------------------------------------------- */

  if (firstActive) {
    const addr =
      firstActive.service_address ||
      firstActive.address ||
      firstActive.customer_email ||
      "your current job";
    suggestions.push({
      id: "local-today-active",
      text: totalOpenToday > 1
        ? `Lock in today’s flow: start with the job you’re currently on, then mentally line up the next one or two stops so you’re never guessing where to go next. Example current job: ${String(
            addr
          ).slice(0, 80)}.`
        : `You have a light route today: focus on doing a clean, documented job at your current stop so wrap-up is fast and there’s nothing left hanging.`,
      actions: [
        firstActive.id && {
          type: "navigate",
          label: "Open active job",
          payload: { jobId: firstActive.id },
        },
        firstActive.id && {
          type: "advance_job_status",
          label: "Advance status",
          payload: { jobId: firstActive.id },
        },
      ].filter(Boolean) as AssistantAction[],
    });
  }

  /* ---- 3. Upcoming jobs (next 24–48 hours) -------------------------------- */

  if (firstUpcoming) {
    const addr =
      firstUpcoming.service_address ||
      firstUpcoming.address ||
      firstUpcoming.customer_email ||
      "your next scheduled job";
    suggestions.push({
      id: "local-upcoming",
      text: `Look ahead at the next day or two and confirm addresses and time windows so there are no surprises, especially for morning jobs. Example upcoming job: ${String(
        addr
      ).slice(0, 80)}.`,
      actions: [
        firstUpcoming.id && {
          type: "navigate",
          label: "Open next job",
          payload: { jobId: firstUpcoming.id },
        },
      ].filter(Boolean) as AssistantAction[],
    });
  }

  /* ---- 4. Leads / pipeline building --------------------------------------- */

  if (topLead) {
    const email =
      topLead.customer_email ||
      topLead.email ||
      topLead.contact_email ||
      "your top lead";
    suggestions.push({
      id: "local-leads",
      text: `Reserve 10 minutes between jobs to move at least one lead forward: call or text ${email} with a clear time offer and lock it into your calendar instead of letting it drift.`,
      actions: [
        {
          type: "open_leads",
          label: "Open leads",
          payload: {},
        },
      ],
    });
  }

  /* ---- 5. Pending invites / portal activation ----------------------------- */

  if (pendingInvites.length > 0) {
    suggestions.push({
      id: "local-invites",
      text:
        "Clean up pending account invites so customers can self-serve for receipts and warranties instead of calling you while you’re on the road.",
      actions: [
        {
          type: "view_invites",
          label: "View pending invites",
          payload: {},
        },
      ],
    });
  }

  /* ---- 6. If basically nothing is scheduled ------------------------------- */

  if (totalOpen === 0 && leadsSorted.length === 0) {
    suggestions.push({
      id: "local-empty-day",
      text:
        "You don’t have any open jobs or leads in the system right now; use the downtime to check tools, stock resin and blades, and review your recent jobs for any missing photos or notes.",
      actions: [],
    });
  }

  /* ---- 7. Always end with a meta suggestion + offline notice -------------- */

  suggestions.push({
    id: "local-meta",
    text: totalOpen > 0
      ? "Keep your pipeline clean: any job that is obviously done or dead should be marked completed or cancelled so the dashboard always reflects reality at a glance."
      : "Keep your dashboard clean: as soon as you confirm new work, create the job immediately so your schedule, leads, and invites always match what’s happening in real life.",
    actions: [],
  });

  suggestions.push({
    id: "local-offline-info",
    text: `AI assistant is running in offline mode right now (${reason}). Suggestions are generated locally from your jobs, leads, and invites so you still have a prioritized plan.`,
    actions: [],
  });

  return {
    suggestions,
    raw: `fallback:${reason}`,
  };
}

/* -------------------------------------------------------------------------- */
/* App Router handler                                                         */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  // Debug info (for a real rate limiter later)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip) {
    // In production you'd enforce per-user/per-IP limits here
  }

  let body: AssistantRequest;
  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const contextParts = [
    summarize("Today jobs", body.todayJobs),
    summarize("All jobs", body.allJobs),
    summarize("Leads", body.bookingLeads),
    summarize("Invites", body.invites),
  ];

  const userPrompt =
    body.prompt?.trim() ||
    "Provide prioritized suggestions and short actionable steps for this technician’s day.";

  // Try RAG (best-effort only; if it fails we just log and continue)
  let ragSummary = "RAG: no extra docs.";
  try {
    const ragDocs = await fetchRagContext({
      techEmail: body.techEmail,
      basePrompt: userPrompt,
    });

    if (ragDocs.length > 0) {
      ragSummary = `RAG: ${ragDocs
        .slice(0, 5)
        .map(
          (d: any) =>
            `[${(d.similarity ?? 0).toFixed(2)}] ${d.title}: ${String(
              d.content
            ).slice(0, 160)}`
        )
        .join(" | ")}`;
    }
  } catch (e) {
    console.warn("Assistant: RAG failed, continuing without it.", e);
  }

  // If there is no key at all, we immediately go to offline Jarvis
  if (!OPENAI_KEY) {
    const fallback = buildFallbackResponse(
      body,
      "no OpenAI API key configured"
    );
    return NextResponse.json(fallback, { status: 200 });
  }

  const system = `You are a concise, practical assistant for a field technician dashboard.
You get:
- A compact summary of today's jobs, pipeline, leads, and user invites
- Optional RAG knowledge snippets (internal procedures, safety notes, best practices)

Your output MUST be valid JSON with a top-level "suggestions" array.
Each suggestion: { id, text, score?, actions? }.

Guidelines:
- Up to 5 suggestions, each 1–2 sentences max, focused on what the tech can do RIGHT NOW.
- "text" is plain text (no markdown).
- "actions" is optional: { type, label?, payload? }.
  - Example actions:
    - { "type": "navigate", "label": "Open next job", "payload": { "jobId": "..." } }
    - { "type": "advance_job_status", "label": "Mark as on_site", "payload": { "jobId": "...", "nextStatus": "on_site" } }
    - { "type": "create_user", "label": "Create user from lead", "payload": { "name": "...", "email": "..." } }

Safety:
- Prefer cautious, safe recommendations.
- If context is empty, give generic but useful productivity advice for the tech.`;

  const user = `Context:
${contextParts.join("\n")}
${ragSummary}

Question: ${userPrompt}

Respond only as JSON, with no explanation, prose, or code fences.`;

  try {
    const rawText = await callOpenAIChat([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);

    // Try to parse JSON; if model misbehaves, wrap it
    let parsed: any = null;
    try {
      const trimmed = rawText.trim();
      const maybeJson =
        trimmed.startsWith("```") && trimmed.includes("{")
          ? trimmed.replace(/```json|```/g, "").trim()
          : trimmed;
      parsed = JSON.parse(maybeJson);
    } catch {
      console.warn("Assistant: JSON parse failed, wrapping raw text");
      parsed = { suggestions: [{ id: "s1", text: String(rawText).trim() }] };
    }

    const suggestions: Suggestion[] = (parsed.suggestions ?? [])
      .slice(0, 5)
      .map((s: any, i: number) => ({
        id: s.id ?? `s${i + 1}`,
        text: s.text ?? s.title ?? s.message ?? JSON.stringify(s),
        score: s.score,
        actions: s.actions ?? [],
      }));

    const response: AssistantResponse = { suggestions, raw: rawText };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    const msg = String(err?.message || "Assistant temporarily unavailable");
    console.error("assistant error", err);

    // Any failure (quota, network, etc.) => smart offline fallback
    let reason = msg;
    if (msg.toLowerCase().includes("quota")) {
      reason = "OpenAI quota exceeded / billing limit reached";
    } else if (msg.toLowerCase().includes("rate limit")) {
      reason = "OpenAI rate limit temporarily hit";
    }

    const fallback = buildFallbackResponse(body, reason);
    return NextResponse.json(fallback, { status: 200 });
  }
}