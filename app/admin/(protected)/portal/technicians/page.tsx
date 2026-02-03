// app/admin/(protected)/technicians/page.tsx
"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Wrench,
  Plus,
  Star,
  Mail,
  Phone,
  Award,
  CheckCircle,
  Search,
  Copy as CopyIcon,
  RefreshCcw,
  Inbox as InboxIcon,
  Info,
} from "lucide-react";

type AnyObj = Record<string, any>;

/* ----------------------------- Data fetchers ----------------------------- */
async function fetchTechnicians(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("technicians")
    .select("*")
    .eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}

async function fetchAppointments(): Promise<AnyObj[]> {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Calls our GET /api/admin/tech-invites with admin bearer (session) */
async function fetchPendingInvites(): Promise<AnyObj[]> {
  const { data: s } = await supabaseClient.auth.getSession();
  const accessToken = s?.session?.access_token;
  if (!accessToken) return [];
  const res = await fetch("/api/admin/tech-invites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Failed to load invites");
  return Array.isArray(json?.invites) ? json.invites : [];
}

/* ------------------------------ Page component ------------------------------ */
export default function AdminTechniciansPage() {
  const qc = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [makingInvite, setMakingInvite] = React.useState(false);
  const [resendingId, setResendingId] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<{
    email: string;
    full_name: string;
    phone: string;
    generated_code: string | null; // from server
  }>({
    email: "",
    full_name: "",
    phone: "",
    generated_code: null,
  });

  const {
    data: technicians = [],
    isLoading: loadingTechs,
    refetch: refetchTechs,
  } = useQuery({
    queryKey: ["admin:technicians"],
    queryFn: fetchTechnicians,
    staleTime: 15_000,
  });

  const {
    data: appointments = [],
    isLoading: loadingApts,
    refetch: refetchApts,
  } = useQuery({
    queryKey: ["admin:appointments:all"],
    queryFn: fetchAppointments,
    staleTime: 15_000,
  });

  const {
    data: invites = [],
    isLoading: loadingInvites,
    refetch: refetchInvites,
  } = useQuery({
    queryKey: ["admin:tech_invites:pending"],
    queryFn: fetchPendingInvites,
    staleTime: 10_000,
  });

  const getTechStats = React.useCallback(
    (techEmail: string) => {
      const techAppts = appointments.filter(
        (a: AnyObj) => a.technician_email === techEmail
      );
      const completed = techAppts.filter((a: AnyObj) =>
        ["completed", "paid"].includes(a.status)
      );
      const active = techAppts.filter(
        (a: AnyObj) => !["completed", "paid", "cancelled"].includes(a.status)
      );
      return {
        total: techAppts.length,
        completed: completed.length,
        active: active.length,
      };
    },
    [appointments]
  );

  const filteredTechnicians = React.useMemo(() => {
    if (!search) return technicians;
    const q = search.toLowerCase();
    return technicians.filter((t: AnyObj) => {
      const name = String(t.full_name ?? "").toLowerCase();
      const email = String(t.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [technicians, search]);

  const loading = loadingTechs || loadingApts;

  async function createInvite() {
    try {
      setMakingInvite(true);
      setCopied(false);

      const { data: s } = await supabaseClient.auth.getSession();
      const accessToken = s?.session?.access_token;
      if (!accessToken) {
        alert("Not signed in as admin.");
        return;
      }

      const res = await fetch("/api/admin/tech-invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create invite");
      }

      const code = json?.invite?.code as string | undefined;
      if (!code) throw new Error("Invite created but no code returned");

      setFormData((s) => ({ ...s, generated_code: code }));

      // Backend handles sending welcome email (with Tech ID + /tech/signup link)
      alert(
        `Invite created and welcome email sent to ${formData.email}. They’ll use their Tech ID and the link to complete signup.`
      );

      qc.invalidateQueries({ queryKey: ["admin:tech_invites:pending"] });
    } catch (e: any) {
      alert(e?.message || "Failed to create invite");
    } finally {
      setMakingInvite(false);
    }
  }

  async function resendInvite(invite: AnyObj) {
    try {
      const id = invite.id || invite.code || invite.email;
      setResendingId(id ?? null);

      const { data: s } = await supabaseClient.auth.getSession();
      const accessToken = s?.session?.access_token;
      if (!accessToken) {
        alert("Not signed in as admin.");
        return;
      }

      // IMPORTANT:
      // This route is implemented to *reuse* the existing pending invite row
      // for this email (and resend its code), NOT create a new row.
      const res = await fetch("/api/admin/tech-invites/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: invite.email,
          // backend looks up the pending invite by email + reason="resend"
          // and re-sends that same code & link
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to resend invite email");
      }

      alert(`Verification email resent to ${invite.email || "technician"}.`);
      qc.invalidateQueries({ queryKey: ["admin:tech_invites:pending"] });
    } catch (e: any) {
      alert(e?.message || "Failed to resend invite email");
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Wrench className="w-8 h-8 text-blue-600" />
              Technician Management
            </h1>
            <p className="text-gray-600 mt-1">Manage your field technicians</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                refetchTechs();
                refetchApts();
                refetchInvites();
              }}
              className="border-slate-300"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            {/* Primary Add Technician trigger in header */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Technician
                </Button>
              </DialogTrigger>

            {/* Shared Dialog content */}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Technician</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Enter the tech’s info and click <strong>Create Invite</strong>. We’ll generate a{" "}
                      <strong>Tech ID</strong> for them and send a welcome email with a link to{" "}
                      <code>/tech/signup</code>.
                    </p>
                  </div>

                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((s) => ({ ...s, email: e.target.value }))
                      }
                      placeholder="tech@example.com"
                    />
                  </div>

                  <div>
                    <Label>Full Name *</Label>
                    <Input
                      value={formData.full_name}
                      onChange={(e) =>
                        setFormData((s) => ({ ...s, full_name: e.target.value }))
                      }
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((s) => ({ ...s, phone: e.target.value }))
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  {!formData.generated_code ? (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={makingInvite || !formData.email || !formData.full_name}
                      onClick={createInvite}
                    >
                      {makingInvite ? "Creating…" : "Create Invite & Send Email"}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Label>Tech ID (optional: share directly)</Label>
                      <div className="flex gap-2">
                        <Input value={formData.generated_code} readOnly />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                formData.generated_code || ""
                              );
                              setCopied(true);
                              setTimeout(() => setCopied(false), 1500);
                            } catch {}
                          }}
                        >
                          <CopyIcon className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {copied
                          ? "Copied!"
                          : "The welcome email also contains this Tech ID and the signup link."}
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search + inline Add Technician button */}
        <Card className="mb-6 border-none shadow-lg bg-white/80 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search technicians by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {/* Secondary Add Technician button inside search section */}
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                onClick={() => {
                  // reset form each time you open from here
                  setFormData({
                    email: "",
                    full_name: "",
                    phone: "",
                    generated_code: null,
                  });
                  setCopied(false);
                  setDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Technician
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Total Technicians</p>
              <p className="text-3xl font-bold">{technicians.length}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Active Today</p>
              <p className="text-3xl font-bold">
                {
                  technicians.filter((t: AnyObj) => {
                    const apts = appointments.filter(
                      (a: AnyObj) => a.technician_email === t.email
                    );
                    return apts.some(
                      (a: AnyObj) =>
                        !["completed", "paid", "cancelled"].includes(a.status)
                    );
                  }).length
                }
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Avg Rating</p>
              <p className="text-3xl font-bold">
                {(
                  technicians.reduce(
                    (sum: number, t: AnyObj) => sum + (t.tech_rating ?? 0),
                    0
                  ) / (technicians.length || 1)
                ).toFixed(1)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <p className="text-sm opacity-90 mb-1">Jobs Completed</p>
              <p className="text-3xl font-bold">
                {
                  appointments.filter((a: AnyObj) =>
                    ["completed", "paid"].includes(a.status)
                  ).length
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Invites */}
        <Card className="mb-8 border-none shadow-lg bg-white/85 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <InboxIcon className="w-5 h-5 text-blue-600" />
              Pending Invites
              {!loadingInvites && (
                <span className="text-sm font-normal text-gray-500">
                  ({invites.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingInvites ? (
              <div className="py-8 text-gray-500 text-sm">Loading invites…</div>
            ) : invites.length === 0 ? (
              <div className="py-8 text-gray-500 text-sm">No pending invites.</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {invites.map((inv: AnyObj) => {
                  const id = inv.id || inv.code || inv.email;
                  const isResending = resendingId === id;
                  return (
                    <div
                      key={inv.id || inv.code}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {inv.full_name || inv.email}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {inv.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-50 text-amber-800 border-amber-200"
                        >
                          Pending
                        </Badge>
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        Expires:{" "}
                        {inv.expires_at
                          ? new Date(inv.expires_at).toLocaleString()
                          : "—"}
                      </div>

                      <p className="mt-2 text-xs text-gray-500">
                        Tech hasn’t completed signup yet. You can resend the welcome email with their Tech ID and signup link.
                      </p>

                      <div className="mt-3">
                        <Button
                          type="button"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          disabled={isResending}
                          onClick={() => resendInvite(inv)}
                        >
                          {isResending ? (
                            <>
                              <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                              Resending…
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-2" />
                              Resend verification email
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading state */}
        {loading && (
          <div className="py-24 text-center text-gray-500">
            <div className="mx-auto h-10 w-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            Loading…
          </div>
        )}

        {/* Technicians Grid */}
        {!loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTechnicians.map((tech: AnyObj) => {
              const apts = appointments.filter(
                (a: AnyObj) => a.technician_email === tech.email
              );
              const completed = apts.filter((a: AnyObj) =>
                ["completed", "paid"].includes(a.status)
              ).length;
              const active = apts.filter(
                (a: AnyObj) =>
                  !["completed", "paid", "cancelled"].includes(a.status)
              ).length;
              const total = apts.length;

              const initials =
                (tech.full_name?.charAt(0) ||
                  tech.email?.charAt(0) ||
                  "T")?.toUpperCase();

              return (
                <Card
                  key={tech.id || tech.email}
                  className="border-none shadow-lg hover:shadow-2xl transition-shadow bg-white/80 backdrop-blur"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow">
                        <span className="text-white font-bold text-lg">
                          {initials}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {tech.full_name || "No Name"}
                        </CardTitle>
                        {typeof tech.tech_rating === "number" && (
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold text-sm">
                              {Number(tech.tech_rating).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{tech.email}</span>
                      </div>
                      {tech.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{tech.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-2xl font-bold text-blue-600">
                            {active}
                          </p>
                          <p className="text-xs text-gray-600">Active</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {completed}
                          </p>
                          <p className="text-xs text-gray-600">Done</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {total}
                          </p>
                          <p className="text-xs text-gray-600">Total</p>
                        </div>
                      </div>
                    </div>

                    {Array.isArray(tech.tech_certifications) &&
                      tech.tech_certifications.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {tech.tech_certifications
                            .slice(0, 2)
                            .map((cert: string, idx: number) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs"
                              >
                                <Award className="w-3 h-3 mr-1" />
                                {cert}
                              </Badge>
                            ))}
                        </div>
                      )}

                    {active > 0 && (
                      <div className="p-2 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-800 font-medium">
                          Currently on duty
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && filteredTechnicians.length === 0 && (
          <Card className="border-2 border-dashed border-gray-300 bg-white/70 backdrop-blur">
            <CardContent className="py-16 text-center">
              <Wrench className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Technicians Found
              </h3>
              <p className="text-gray-600 mb-6">
                Add your first technician to get started
              </p>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setFormData({
                    email: "",
                    full_name: "",
                    phone: "",
                    generated_code: null,
                  });
                  setCopied(false);
                  setDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Technician
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}