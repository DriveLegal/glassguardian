// app/tech/(protected)/dashboard/users/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Search,
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  ArrowRight,
  PlusCircle,
  Eye,
  Send,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { getTechIdentity } from "@/lib/techAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import { TechToast, TechToastState } from "@/components/tech/TechToast";

type UserInvite = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  code: string;
  created_at: string;
  used_at: string | null;
};

type NewUserForm = {
  full_name: string;
  email: string;
  phone: string;
};

/* --------------------------- Glass helpers --------------------------- */

function GlassPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative rounded-2xl border border-slate-700/70 bg-slate-900/55 backdrop-blur-xl shadow-[0_22px_70px_rgba(15,23,42,0.9)]",
        className,
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(148,163,184,0.22), rgba(15,23,42,0.05) 40%, transparent 70%)",
          mixBlendMode: "screen",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3">
      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <span className="mt-1 text-2xl font-semibold text-slate-50 tabular-nums">
        {value}
      </span>
    </div>
  );
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function escapeForIlikeExact(v: string) {
  return v.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export const dynamic = "force-dynamic";

export default function TechUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [techEmail, setTechEmail] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "pending" | "active"
  >("all");

  // New user modal state
  const [userOpen, setUserOpen] = React.useState(false);
  const [userBusy, setUserBusy] = React.useState(false);
  const [userErr, setUserErr] = React.useState<string | null>(null);
  const [userForm, setUserForm] = React.useState<NewUserForm>({
    full_name: "",
    email: "",
    phone: "",
  });

  // track which invite is resending
  const [resendBusyId, setResendBusyId] = React.useState<string | null>(null);

  // toast
  const [toast, setToast] = React.useState<TechToastState>({
    open: false,
    title: "",
    message: "",
    variant: "info",
  });

  const canCreateUser =
    userForm.full_name.trim().length > 1 &&
    userForm.email.trim().length > 3 &&
    !userBusy;

  /* --------------------------- Auth gate --------------------------- */

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const id = await getTechIdentity();
      if (!mounted) return;

      if (!id) {
        router.replace(
          `/tech/login?redirect=${encodeURIComponent("/tech/dashboard/users")}`
        );
        return;
      }

      setTechEmail(id.email);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  /* --------------------------- Data: invites + hydrate names from app_users --------------------------- */

  const {
    data: invites = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["tech:users:list", techEmail],
    enabled: !!techEmail,

    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,

    queryFn: async () => {
      const { data: inviteRows, error: invErr } = await supabaseClient
        .from("user_invites")
        .select("id, full_name, email, phone, code, created_at, used_at")
        .eq("created_by_tech_email", techEmail!)
        .order("created_at", { ascending: false });

      if (invErr) throw invErr;

      const baseInvites = (inviteRows ?? []) as UserInvite[];
      if (!baseInvites.length) return baseInvites;

      const emails = Array.from(
        new Set(baseInvites.map((u) => normEmail(u.email)).filter(Boolean))
      );
      if (!emails.length) return baseInvites;

      const CHUNK = 40;
      const nameByEmail = new Map<string, string>();

      for (let i = 0; i < emails.length; i += CHUNK) {
        const slice = emails.slice(i, i + CHUNK);
        const orFilter = slice
          .map((e) => `email.ilike.${escapeForIlikeExact(e)}`)
          .join(",");

        const { data: appUsers, error: auErr } = await supabaseClient
          .from("app_users")
          .select("email, full_name")
          .or(orFilter);

        if (auErr) return baseInvites;

        for (const r of (appUsers ?? []) as any[]) {
          const e = normEmail(r?.email);
          const n = String(r?.full_name ?? "").trim();
          if (e && n) nameByEmail.set(e, n);
        }
      }

      return baseInvites.map((u) => {
        const e = normEmail(u.email);
        const betterName = e ? nameByEmail.get(e) : undefined;
        return betterName ? { ...u, full_name: betterName } : u;
      });
    },
  });

  /* --------------------------- Derived stats + filters --------------------------- */

  const filteredInvites = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return invites.filter((u) => {
      if (statusFilter === "pending" && u.used_at) return false;
      if (statusFilter === "active" && !u.used_at) return false;
      if (!q) return true;

      const haystack = [u.full_name || "", u.email || "", u.phone || "", u.code || ""]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [invites, search, statusFilter]);

  /* --------------------------- Create new user --------------------------- */

  async function submitNewUser() {
    try {
      setUserBusy(true);
      setUserErr(null);

      const { data: s } = await supabaseClient.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Not signed in.");

      const res = await fetch("/api/tech/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: userForm.full_name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create user");

      setUserOpen(false);
      setUserForm({ full_name: "", email: "", phone: "" });

      queryClient.invalidateQueries({ queryKey: ["tech:users:list", techEmail] });

      setToast({
        open: true,
        variant: "success",
        title: "Invite created",
        message: "Customer invite created and emailed successfully.",
      });
    } catch (e: any) {
      setUserErr(e?.message || "Failed to create user");
      setToast({
        open: true,
        variant: "error",
        title: "Couldn’t create invite",
        message: e?.message || "Please try again.",
      });
    } finally {
      setUserBusy(false);
    }
  }

  /* --------------------------- Resend invite email --------------------------- */

  async function handleResendInvite(u: UserInvite) {
    try {
      setResendBusyId(u.id);

      const { data: s } = await supabaseClient.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error("Not signed in.");

      // ✅ FIX: API expects { action:"resend", invite_id }
      const res = await fetch("/api/tech/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "resend",
          invite_id: u.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to resend invite email");

      setToast({
        open: true,
        variant: "success",
        title: "Invite resent",
        message: `Sent again to ${u.email}`,
      });
    } catch (e: any) {
      setToast({
        open: true,
        variant: "error",
        title: "Resend failed",
        message: e?.message || "Please try again.",
      });
    } finally {
      setResendBusyId(null);
    }
  }

  function handleViewUser(u: UserInvite) {
    router.push(`/tech/dashboard/users/${u.id}`);
  }

  return (
    <div className="space-y-6">
      <TechToast
        toast={toast}
        onCloseAction={() => setToast((t) => ({ ...t, open: false }))}
      />

      <GlassPanel className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center shadow-[0_18px_55px_rgba(56,189,248,0.6)] border border-white/20">
              <UserIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-sky-300/90">
                CUSTOMER ROSTER
              </p>
              <h2 className="text-xl md:text-2xl font-semibold text-slate-50">
                Users you&apos;ve invited
              </h2>
              <p className="text-xs md:text-sm text-slate-400 mt-1">
                Track every customer you&apos;ve invited — pending vs active, resend invites, and open user profiles.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-3">
            <div className="flex gap-3">
              <StatPill label="Total Users" value={invites.length} />
              <StatPill
                label="Active"
                value={invites.filter((u) => u.used_at !== null).length}
              />
              <StatPill
                label="Pending"
                value={invites.filter((u) => u.used_at === null).length}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                className="bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-2 rounded-full px-4 py-2"
                onClick={() => {
                  setUserErr(null);
                  setUserOpen(true);
                }}
              >
                <PlusCircle className="w-4 h-4" />
                Create User
              </Button>
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or code…"
            className="pl-9 bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500 focus-visible:ring-1 focus-visible:border-sky-500"
          />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-1.5 py-1">
          {(["all", "pending", "active"] as const).map((val) => {
            const isActive = statusFilter === val;
            const label =
              val === "all" ? "All" : val === "pending" ? "Pending" : "Active";
            return (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={[
                  "px-3 py-1 text-xs rounded-full transition-all",
                  isActive
                    ? "bg-sky-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.6)]"
                    : "text-slate-300 hover:bg-slate-800/70",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <GlassPanel className="p-4 md:p-5">
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            Loading users…
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-rose-300 text-sm">
            Unable to load users right now.
          </div>
        ) : filteredInvites.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            {search || statusFilter !== "all"
              ? "No users match this search/filter."
              : "You haven’t invited any users yet. Start by creating your first user invite."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvites.map((u) => {
              const isActiveUser = !!u.used_at;
              const createdAtLabel = u.created_at
                ? format(new Date(u.created_at), "MMM d, yyyy h:mma")
                : "";
              const usedAtLabel = u.used_at
                ? format(new Date(u.used_at), "MMM d, yyyy h:mma")
                : null;

              return (
                <div
                  key={u.id}
                  className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/55 px-4 py-3 md:px-5 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="pointer-events-none absolute inset-y-0 -left-10 w-32 bg-gradient-to-r from-sky-500/20 via-emerald-400/5 to-transparent blur-3xl" />

                  <div className="relative flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 border border-slate-600">
                      <UserIcon className="h-4 w-4 text-slate-200" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-50">
                          {u.full_name || "Unnamed user"}
                        </p>
                        <Badge
                          className={
                            isActiveUser
                              ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100 text-[11px]"
                              : "border-amber-400/70 bg-amber-500/15 text-amber-100 text-[11px]"
                          }
                        >
                          {isActiveUser ? "Active account" : "Pending account"}
                        </Badge>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="break-all">{u.email}</span>
                        </span>
                        {u.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{u.phone}</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Invited {createdAtLabel}</span>
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <span className="uppercase tracking-[0.2em] text-slate-500">
                            CODE
                          </span>
                          <span className="font-mono text-xs tracking-[0.22em] text-slate-100">
                            {u.code}
                          </span>
                        </span>

                        {usedAtLabel && (
                          <span className="inline-flex items-center gap-1">
                            Joined {usedAtLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative flex flex-wrap gap-2 self-start sm:self-auto">
                    {!isActiveUser && (
                      <Button
                        className={[
                          "group relative overflow-hidden rounded-full px-3.5 py-2 text-xs font-semibold",
                          "text-white bg-gradient-to-b from-sky-500 to-sky-600 border border-white/15",
                          "shadow-[0_16px_45px_rgba(56,189,248,0.35)] hover:shadow-[0_18px_60px_rgba(56,189,248,0.55)]",
                          "transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0",
                          "disabled:opacity-60 disabled:hover:translate-y-0",
                        ].join(" ")}
                        disabled={resendBusyId === u.id}
                        onClick={() => handleResendInvite(u)}
                      >
                        <span className="relative inline-flex items-center gap-1.5">
                          <Send className="h-3.5 w-3.5" />
                          {resendBusyId === u.id ? "Resending…" : "Resend Email"}
                        </span>
                      </Button>
                    )}

                    <Button
                      className={[
                        "group relative overflow-hidden rounded-full px-3.5 py-2 text-xs font-semibold",
                        "text-slate-50 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-600/80",
                        "shadow-[0_14px_42px_rgba(15,23,42,0.6)] hover:shadow-[0_18px_58px_rgba(56,189,248,0.25)]",
                        "transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0",
                      ].join(" ")}
                      onClick={() => handleViewUser(u)}
                    >
                      <span className="relative inline-flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        View User
                        <ArrowRight className="h-3.5 w-3.5 opacity-80 transition-transform duration-200 group-hover:translate-x-[1px]" />
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="max-w-md bg-slate-950 border-slate-700 text-slate-50">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription className="text-slate-400">
              Create a customer invite. We’ll email them a link and 7-digit code
              to create their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {userErr && (
              <div className="rounded-md border border-red-500/70 bg-red-900/40 px-3 py-2 text-sm text-red-100">
                {userErr}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Full Name
              </label>
              <Input
                value={userForm.full_name}
                onChange={(e) =>
                  setUserForm((s) => ({ ...s, full_name: e.target.value }))
                }
                placeholder="Customer name"
                className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500 focus-visible:ring-1 focus-visible:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm((s) => ({ ...s, email: e.target.value }))
                }
                placeholder="customer@example.com"
                className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500 focus-visible:ring-1 focus-visible:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Phone
              </label>
              <Input
                type="tel"
                value={userForm.phone}
                onChange={(e) =>
                  setUserForm((s) => ({ ...s, phone: e.target.value }))
                }
                placeholder="(555) 555-5555"
                className="bg-slate-950/70 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-sky-500 focus-visible:ring-1 focus-visible:border-sky-500"
              />
            </div>

            <p className="text-xs text-slate-400">
              You can invite customers even if they don&apos;t have an account yet — we link by email later.
            </p>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setUserOpen(false)}
              disabled={userBusy}
              className="border-slate-600 text-slate-100 bg-slate-900/70 hover:border-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={submitNewUser}
              disabled={canCreateUser === false}
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              {userBusy ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}