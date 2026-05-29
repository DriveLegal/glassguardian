//app/admin/(protected)/portal/customers/new/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  ArrowLeft,
  Mail,
  Phone,
  User as UserIcon,
  Info,
  CheckCircle2,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type NewUserForm = {
  full_name: string;
  email: string;
  phone: string;
};

export default function AdminNewCustomerPage() {
  const router = useRouter();

  const [form, setForm] = React.useState<NewUserForm>({
    full_name: "",
    email: "",
    phone: "",
  });

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSubmit =
    form.full_name.trim().length > 1 &&
    form.email.trim().length > 3 &&
    !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setBusy(true);
      setError(null);

      const { data: s } = await supabaseClient.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Not signed in.");

      // 🔁 same route / logic as tech Create User
      const res = await fetch("/api/tech/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create user");
      }

      const userCode = json?.user_code as string | undefined;
      const code = userCode || "Created";

      // 🔁 After creation, route back to customers with success info in query
      router.push(
        `/admin/portal/customers?created=1&invite_code=${encodeURIComponent(
          code
        )}`
      );
    } catch (err: any) {
      setError(err?.message || "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[radial-gradient(circle_at_top,_#1e293b_0,_#020617_40%,_#000000_100%)] text-slate-100">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/portal/customers"
              className="inline-flex items-center text-sm text-slate-300 hover:text-slate-50 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to customers
            </Link>
          </div>

          <div className="inline-flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                <Users className="w-6 h-6 text-slate-950" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                New Customer
              </h1>
              <p className="text-sm text-slate-400">
                Create a portal-ready customer and email them their access code.
              </p>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {/* FORM CARD */}
          <Card className="border border-cyan-500/20 bg-slate-900/70 backdrop-blur-xl shadow-[0_0_45px_rgba(15,23,42,0.95)]">
            <CardContent className="p-5 md:p-7">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-cyan-500/40 blur-xl" />
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 border border-cyan-400/60">
                      <UserIcon className="w-5 h-5 text-cyan-300" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Customer Details
                    </p>
                    <p className="text-xs text-slate-400">
                      This creates an invite linked to their email and phone.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-md border border-red-500/70 bg-red-900/50 px-3 py-2 text-sm text-red-50">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Full Name
                    </label>
                    <Input
                      value={form.full_name}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, full_name: e.target.value }))
                      }
                      placeholder="Customer name"
                      className="bg-slate-950/70 border border-slate-700/80 text-black-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, email: e.target.value }))
                        }
                        placeholder="customer@example.com"
                        className="pl-9 bg-slate-950/70 border border-slate-700/80 text-black-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Phone (optional)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, phone: e.target.value }))
                        }
                        placeholder="(555) 555-5555"
                        className="pl-9 bg-slate-950/70 border border-slate-700/80 text-black-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    We&apos;ll generate a 7-digit ID, store the customer in{" "}
                    <span className="font-mono text-slate-200">app_users</span>{" "}
                    and email them an instant login link.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/admin/portal/customers")}
                      disabled={busy}
                      className="border-slate-600/80 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.7)]"
                    >
                      {busy ? (
                        <>
                          <span className="h-4 w-4 mr-2 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
                          Creating…
                        </>
                      ) : (
                        "Create Customer"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* RIGHT PANEL / INFO */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Card className="border border-slate-700/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_0_45px_rgba(15,23,42,0.95)]">
              <CardContent className="p-5 md:p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-300" />
                  <p className="text-sm font-medium text-slate-100">
                    What happens when you create a customer?
                  </p>
                </div>

                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-start gap-2">
                    <Badge className="mt-0.5 h-5 px-2 text-[10px] bg-cyan-500/20 border-cyan-400/60 text-cyan-100">
                      STEP 1
                    </Badge>
                    <p>
                      We create an invite record + portal user tied to their
                      email (and phone if provided).
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="mt-0.5 h-5 px-2 text-[10px] bg-emerald-500/20 border-emerald-400/60 text-emerald-100">
                      STEP 2
                    </Badge>
                    <p>
                      The customer receives an email with their 7-digit ID and a
                      secure link to the user portal.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="mt-0.5 h-5 px-2 text-[10px] bg-violet-500/20 border-violet-400/60 text-violet-100">
                      STEP 3
                    </Badge>
                    <p>
                      As soon as they activate, they&apos;ll appear in{" "}
                      <span className="font-mono text-slate-100">
                        Customer Galaxy
                      </span>{" "}
                      with{" "}
                      <span className="inline-flex items-center gap-1 text-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Portal Active
                      </span>
                      .
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 px-4 py-3 text-xs text-slate-400">
                  <p className="mb-1 font-medium text-slate-200">
                    Pro tip for dispatch:
                  </p>
                  <p>
                    After creating a customer here, you can immediately attach
                    them to new appointments, vehicles, and invoices from the
                    admin portal — their portal profile will sync automatically
                    once they log in.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}