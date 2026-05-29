// app/tech/(protected)/dashboard/settings/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Phone,
  User,
  Mail,
  ShieldCheck,
  Save,
  Loader2,
  ArrowLeft,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TechRow = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
};

function cleanPhone(v: string) {
  return String(v ?? "").trim().slice(0, 30);
}

function cleanName(v: string) {
  return String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

async function getAccessTokenBestEffort(): Promise<string> {
  const { data: s1 } = await supabaseClient.auth.getSession();
  let tok = s1?.session?.access_token || "";
  if (!tok) {
    await supabaseClient.auth.refreshSession().catch(() => {});
    const { data: s2 } = await supabaseClient.auth.getSession();
    tok = s2?.session?.access_token || "";
  }
  return tok;
}

async function ensureTechRowExistsOrUpdated() {
  const token = await getAccessTokenBestEffort();
  if (!token) return;

  await fetch("/api/tech/profile/ensure", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export default function TechSettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const [authUserId, setAuthUserId] = React.useState<string | null>(null);
  const [authEmail, setAuthEmail] = React.useState<string | null>(null);
  const [authName, setAuthName] = React.useState<string | null>(null);

  const [phone, setPhone] = React.useState<string>("");
  const [fullName, setFullName] = React.useState<string>("");

  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // Hydrate session
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const s = data?.session ?? null;

      if (!mounted) return;

      if (!s?.user) {
        router.replace(
          `/login?redirect=${encodeURIComponent("/tech/dashboard/settings")}`
        );
        return;
      }

      setAuthUserId(s.user.id);
      setAuthEmail(s.user.email ?? null);

      const metaName =
        (s.user.user_metadata as any)?.full_name ||
        (s.user.user_metadata as any)?.name ||
        null;

      setAuthName(metaName ? cleanName(metaName) : null);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  // Load tech row by auth_user_id first (best), fallback by email
  const { data: techRow, isLoading, refetch } = useQuery({
    queryKey: ["tech:settings:row", authUserId, authEmail],
    enabled: !!authUserId || !!authEmail,
    queryFn: async () => {
      setErr(null);
      setMsg(null);

      // 1) auth_user_id
      if (authUserId) {
        const { data, error } = await supabaseClient
          .from("technicians")
          .select("id,auth_user_id,email,full_name,phone")
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        if (!error && data) return data as TechRow;
      }

      // 2) email fallback (case-insensitive)
      if (authEmail) {
        const { data, error } = await supabaseClient
          .from("technicians")
          .select("id,auth_user_id,email,full_name,phone")
          .ilike("email", authEmail)
          .maybeSingle();

        if (!error && data) return data as TechRow;
      }

      return null as TechRow | null;
    },
    staleTime: 10_000,
  });

  // Sync form state when row loads
  React.useEffect(() => {
    if (!techRow) return;
    setPhone(techRow.phone ?? "");
    setFullName(techRow.full_name ?? "");
  }, [techRow?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setErr(null);
      setMsg(null);

      if (!authUserId) throw new Error("Not signed in.");
      if (!authEmail) throw new Error("Missing email in session.");

      // ✅ Ensure row exists & auth_user_id is set (service-role route)
      await ensureTechRowExistsOrUpdated();
      await refetch();

      const nextPhone = cleanPhone(phone);

      // full_name is NOT NULL in your table, so we must always provide something
      const nextName =
        cleanName(fullName) ||
        cleanName(authName ?? "") ||
        cleanName(authEmail.split("@")[0] ?? "") ||
        "Technician";

      // Reload latest row (after ensure)
      const latest = await (async () => {
        if (authUserId) {
          const r = await supabaseClient
            .from("technicians")
            .select("id,auth_user_id,email,full_name,phone")
            .eq("auth_user_id", authUserId)
            .maybeSingle();
          if (!r.error && r.data) return r.data as TechRow;
        }
        const r2 = await supabaseClient
          .from("technicians")
          .select("id,auth_user_id,email,full_name,phone")
          .ilike("email", authEmail)
          .maybeSingle();
        if (!r2.error && r2.data) return r2.data as TechRow;
        return null;
      })();

      // ✅ Prefer updating by primary key id (most stable)
      if (latest?.id) {
        const { data, error } = await supabaseClient
          .from("technicians")
          .update({
            phone: nextPhone || null,
            full_name: nextName,
          })
          .eq("id", latest.id)
          .select("id,auth_user_id,email,full_name,phone")
          .single();

        if (error) throw error;
        return data as TechRow;
      }

      // Fallback insert (should be rare now because ensure runs)
      const { data: ins, error: insErr } = await supabaseClient
        .from("technicians")
        .insert({
          auth_user_id: authUserId,
          email: authEmail,
          full_name: nextName,
          phone: nextPhone || null,
        })
        .select("id,auth_user_id,email,full_name,phone")
        .single();

      if (insErr) throw insErr;
      return ins as TechRow;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["tech:settings:row", authUserId, authEmail],
      });
      setMsg("Saved.");
    },
    onError: (e: any) => {
      setErr(e?.message ?? "Failed to save.");
    },
  });

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative w-full max-w-4xl mx-auto px-4 py-8"
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
          onClick={() => router.push("/tech/dashboard")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Badge
          variant="outline"
          className="border-slate-600/80 bg-slate-900/60 text-slate-100"
        >
          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
          Tech Settings
        </Badge>
      </div>

      <Card className="border border-slate-800 bg-slate-950/60 text-white overflow-hidden">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="flex items-center gap-2 text-sky-200">
            <SettingsIcon className="w-5 h-5 text-sky-300" />
            Account Settings
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 md:p-6 space-y-5">
          {isLoading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : null}

          {err ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {err}
            </div>
          ) : null}

          {msg ? (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {msg}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <User className="w-4 h-4" /> Display name
              </div>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={authName ?? "Your name"}
                className="mt-3 bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
              <p className="mt-2 text-[0.72rem] text-slate-400">
                This is stored in your technician profile.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <Phone className="w-4 h-4" /> Phone number
              </div>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="909-529-1798"
                className="mt-3 bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
              <p className="mt-2 text-[0.72rem] text-slate-400">
                Used for internal routing + contact.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              <Mail className="w-4 h-4" /> Signed-in email
            </div>
            <p className="mt-2 text-sm text-slate-100 break-all">
              {authEmail ?? "—"}
            </p>
            {techRow?.id ? (
              <p className="mt-1 text-[0.72rem] text-slate-500">
                Technician row: <span className="text-slate-300">{techRow.id}</span>
              </p>
            ) : (
              <p className="mt-1 text-[0.72rem] text-slate-500">
                No technician row detected yet — saving will create it.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !authUserId}
              className="bg-sky-500 hover:bg-sky-600 text-slate-950 font-semibold"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
