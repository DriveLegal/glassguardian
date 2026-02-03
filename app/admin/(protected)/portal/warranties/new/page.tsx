// app/admin/(protected)/portal/warranties/new/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Car,
  Mail,
  Calendar,
  MapPin,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Users,
  Search,
} from "lucide-react";

/* -------------------- Helpers for date math -------------------- */

function addYearsToDate(isoDate: string, years: number): string {
  // isoDate expected as "YYYY-MM-DD"
  const base = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(base.getTime())) return isoDate;

  base.setFullYear(base.getFullYear() + years);

  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* -------------------- Helper to auto-generate warranty number -------------------- */

function generateWarrantyNumber(serviceDate: string, email: string): string {
  // serviceDate: "YYYY-MM-DD"
  const datePart = serviceDate.replace(/-/g, ""); // e.g. 20251130
  const emailPart = email.split("@")[0]?.toUpperCase().slice(0, 4) || "CUST";
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6); // 4-char random chunk

  return `GG-${datePart}-${emailPart}-${rand}`;
}

/* -------------------- Infer a decent full name from email -------------------- */

function inferFullNameFromEmail(email: string): string {
  const local = email.split("@")[0] || "";
  if (!local) return "Glass Guardian Customer";

  // turn "john.doe-smith_92" → ["john","doe","smith","92"]
  const cleaned = local.replace(/[._-]+/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (!parts.length) return "Glass Guardian Customer";

  const titled = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");

  return titled || "Glass Guardian Customer";
}

/* -------------------- Local windshield map (admin-only picker) -------------------- */

const QUADRANTS = [
  { id: "top_left", label: "Top L" },
  { id: "top_center", label: "Top C" },
  { id: "top_right", label: "Top R" },
  { id: "mid_left", label: "Mid L" },
  { id: "center", label: "Center" },
  { id: "mid_right", label: "Mid R" },
  { id: "bottom_left", label: "Bot L" },
  { id: "bottom_center", label: "Bot C" },
  { id: "bottom_right", label: "Bot R" },
];

function quadrantFromXY(x: number, y: number) {
  const cx = Math.min(0.9999, Math.max(0, x));
  const cy = Math.min(0.9999, Math.max(0, y));
  const col = Math.floor(cx * 3); // 0..2
  const row = Math.floor(cy * 3); // 0..2
  const idx = row * 3 + col;
  return QUADRANTS[idx] || QUADRANTS[4]; // center fallback
}

type WindshieldSpotPickerProps = {
  value: string;
  onChange: (val: string) => void;
};

function WindshieldSpotPicker({ value, onChange }: WindshieldSpotPickerProps) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const [marker, setMarker] = React.useState<{ x: number; y: number } | null>(
    null
  );
  const [selectedQuadrantId, setSelectedQuadrantId] =
    React.useState<string | null>(null);

  function handleMapClick(e: React.MouseEvent) {
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    const x = Math.min(0.9999, Math.max(0, cx));
    const y = Math.min(0.9999, Math.max(0, cy));

    const q = quadrantFromXY(x, y);
    setMarker({ x, y });
    setSelectedQuadrantId(q.id);

    // store a nice label that shows up on the warranty
    onChange(q.label);
  }

  const markerLeft = marker ? `${marker.x * 100}%` : "50%";
  const markerTop = marker ? `${marker.y * 100}%` : "50%";

  return (
    <div className="space-y-2">
      <div
        ref={mapRef}
        onClick={handleMapClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
          }
        }}
        className="relative rounded-2xl overflow-hidden border border-cyan-200/60 bg-gradient-to-b from-slate-900/70 to-slate-950 shadow-[0_16px_40px_rgba(8,47,73,0.9)] cursor-crosshair"
        style={{ aspectRatio: "3 / 1" }}
      >
        {/* 9-grid background */}
        <div className="grid grid-cols-3 h-full">
          {QUADRANTS.map((q, idx) => {
            const active = selectedQuadrantId === q.id;
            return (
              <div
                key={q.id}
                className={[
                  "relative flex items-center justify-center text-[11px] font-medium border-slate-700/80",
                  idx < 6 ? "border-b" : "",
                  idx % 3 !== 2 ? "border-r" : "",
                  active
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "text-slate-400 bg-slate-900/40",
                ].join(" ")}
              >
                <span className="relative z-10 opacity-90">{q.label}</span>
              </div>
            );
          })}
        </div>

        {/* glass arc overlay */}
        <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 w-[82%] h-6 rounded-full border border-cyan-200/80 border-b-0 bg-gradient-to-b from-cyan-200/60 via-sky-300/20 to-transparent opacity-80" />

        {/* marker */}
        {marker && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center"
            style={{ left: markerLeft, top: markerTop }}
          >
            <span className="text-2xl font-black text-emerald-200 drop-shadow-[0_0_10px_rgba(16,185,129,0.85)] pointer-events-none select-none">
              ✕
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        {value
          ? `Selected: ${value} (this label will show on the warranty card under "Spot Repaired").`
          : 'Click anywhere on the windshield to mark the repaired spot. We’ll save a short label like "Top L" or "Center".'}
      </p>
    </div>
  );
}

/* -------------------- Types -------------------- */

type AppUser = {
  id: string;
  email: string;
  full_name: string | null;
};

/* -------------------- Main Page -------------------- */

export default function AdminNewWarrantyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Prefill customer_email if you navigate with ?email=...
  const prefillEmail = searchParams.get("email") || "";

  const [submitting, setSubmitting] = React.useState(false);
  const [successId, setSuccessId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    customer_name: "",
    customer_email: prefillEmail,
    warranty_number: "",
    status: "active",
    service_performed: "Windshield chip / crack repair",
    service_date: "",
    coverage_type: "2_year" as "2_year" | "1_year" | "lifetime" | "limited",
    vehicle_year: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_plate: "",
    spot_location: "",
    notes: "",
  });

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ---------- Load app_users for dropdown attach ---------- */

  const [appUsers, setAppUsers] = React.useState<AppUser[]>([]);
  const [appUsersLoading, setAppUsersLoading] = React.useState<boolean>(true);
  const [appUsersError, setAppUsersError] = React.useState<string | null>(null);
  const [selectedAppUserId, setSelectedAppUserId] = React.useState<string>("");
  const [customerSearch, setCustomerSearch] = React.useState<string>("");

  React.useEffect(() => {
    let isMounted = true;

    async function loadAppUsers() {
      try {
        setAppUsersLoading(true);
        setAppUsersError(null);

        const { data, error } = await supabaseClient
          .from("app_users")
          .select("id, email, full_name")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!isMounted) return;

        const list = (data ?? []) as AppUser[];
        setAppUsers(list);

        // If we arrived with ?email=..., auto-select matching app_user
        if (prefillEmail) {
          const match = list.find(
            (u) =>
              u.email &&
              u.email.toLowerCase() === prefillEmail.toLowerCase()
          );
          if (match) {
            setSelectedAppUserId(match.id);
            setForm((prev) => ({
              ...prev,
              customer_email: match.email,
              customer_name:
                match.full_name && match.full_name.trim().length > 0
                  ? match.full_name
                  : inferFullNameFromEmail(match.email),
            }));
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setAppUsersError(
          err?.message || "Failed to load existing portal customers."
        );
      } finally {
        if (isMounted) {
          setAppUsersLoading(false);
        }
      }
    }

    loadAppUsers();
    return () => {
      isMounted = false;
    };
  }, [prefillEmail]);

  const filteredAppUsers = React.useMemo(() => {
    if (!customerSearch.trim()) return appUsers;
    const q = customerSearch.toLowerCase();
    return appUsers.filter((u) => {
      const name = (u.full_name ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [appUsers, customerSearch]);

  function handleSelectAppUser(id: string) {
    setSelectedAppUserId(id);
    const chosen = appUsers.find((u) => u.id === id);
    if (!chosen) return;

    const email = chosen.email;
    const fullName =
      chosen.full_name && chosen.full_name.trim().length > 0
        ? chosen.full_name
        : inferFullNameFromEmail(chosen.email);

    setForm((prev) => ({
      ...prev,
      customer_email: email,
      customer_name: fullName,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessId(null);

    try {
      if (!form.customer_email) {
        throw new Error("Customer email is required.");
      }
      if (!form.service_date) {
        throw new Error("Service date is required.");
      }

      // normalize email & name once
      const normalizedEmail = form.customer_email.trim().toLowerCase();
      const typedName = form.customer_name.trim();

      // 👇 this is the value that should go into app_users.full_name
      const fullName =
        typedName.length > 0
          ? typedName
          : inferFullNameFromEmail(normalizedEmail);

      // compute expiration_date from coverage_type + service_date
      let expiration_date: string | null = null;
      if (form.coverage_type === "2_year") {
        expiration_date = addYearsToDate(form.service_date, 2);
      } else if (form.coverage_type === "1_year") {
        expiration_date = addYearsToDate(form.service_date, 1);
      } else {
        // lifetime / limited → no expiration
        expiration_date = null;
      }

      // Always provide a non-null warranty_number:
      const trimmedManual = form.warranty_number.trim();
      const finalWarrantyNumber =
        trimmedManual ||
        generateWarrantyNumber(form.service_date, normalizedEmail);

      // Build insert payload for warranties (do NOT add new columns here)
      const payload: Record<string, any> = {
        customer_email: normalizedEmail,
        warranty_number: finalWarrantyNumber,
        status: form.status,
        service_performed: form.service_performed || null,
        service_date: form.service_date, // ISO date (yyyy-mm-dd)
        coverage_type: form.coverage_type,
        expiration_date,
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
        vehicle_make: form.vehicle_make || null,
        vehicle_model: form.vehicle_model || null,
        vehicle_plate: form.vehicle_plate || null,
        spot_location: form.spot_location || null,
        notes: form.notes || null,
      };

      const { data, error: insertErr } = await supabaseClient
        .from("warranties")
        .insert(payload)
        .select("id")
        .single();

      if (insertErr) {
        console.error(insertErr);
        throw new Error(insertErr.message ?? "Failed to create warranty.");
      }

      // ✅ Warranty created
      setSuccessId(data.id as string);

      // ✅ Make sure there's an app_users row for magic login links
      // FULL NAME here reflects the CUSTOMER NAME you typed / selected
      const { error: appUserErr } = await supabaseClient
        .from("app_users")
        .upsert(
          {
            email: normalizedEmail,
            full_name: fullName,
          },
          {
            onConflict: "email",
          }
        );

      if (appUserErr) {
        console.error("[app_users upsert error]", appUserErr);
        setError(
          `Warranty created, but syncing app_users failed: ${appUserErr.message}`
        );
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong creating the warranty.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gg-warranty-dark min-h-screen p-4 md:p-8 bg-[radial-gradient(circle_at_top,_#020617_0,_#020617_45%,_#000000_100%)] text-slate-100">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 bg-slate-950/80 text-slate-100 hover:border-cyan-400 hover:text-cyan-100 hover:bg-slate-950/95"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {successId && !error && (
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.7)]"
              onClick={() => router.push(`/user/warranties/${successId}`)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              View as Customer
            </Button>
          )}
        </div>

        {/* Main card */}
        <Card className="border border-cyan-500/25 bg-slate-950/85 backdrop-blur-xl shadow-[0_0_65px_rgba(8,47,73,0.9)]">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-500/40 blur-xl" />
                <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 flex items-center justify-center shadow-[0_0_35px_rgba(34,211,238,0.8)]">
                  <Shield className="w-5 h-5 text-slate-950" />
                </div>
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">
                  Create Warranty for Past Customer
                </CardTitle>
                <p className="text-xs text-slate-400">
                  Attach this warranty to an existing Glass Guardian portal
                  customer or manually enter their details.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 md:p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Attach to existing customer (from app_users) */}
              <div className="rounded-xl border border-cyan-500/25 bg-gradient-to-br from-slate-950/90 via-slate-950 to-slate-950/95 px-4 py-4 space-y-3 shadow-[0_0_35px_rgba(8,47,73,0.8)]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-xl" />
                    <div className="relative h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center border border-cyan-400/70">
                      <Users className="w-4 h-4 text-cyan-200" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-cyan-100">
                      Attach to Portal Customer
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Pulls from <span className="font-mono">app_users</span>.
                      Selecting a customer will auto-fill email and name.
                    </p>
                  </div>
                </div>

                {appUsersError && (
                  <p className="text-[11px] text-red-300 bg-red-950/40 border border-red-500/40 rounded-md px-3 py-1.5">
                    {appUsersError}
                  </p>
                )}

                {appUsersLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-slate-300">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    Loading portal customers…
                  </div>
                ) : appUsers.length === 0 ? (
                  <p className="text-[12px] text-slate-400">
                    No portal customers found in{" "}
                    <span className="font-mono">app_users</span> yet. You can
                    still create a warranty by manually entering the customer
                    email below.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <Input
                        placeholder="Search customers by name or email…"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-8 text-xs bg-slate-950/80 border-slate-700/80"
                      />
                    </div>

                    <select
                      value={selectedAppUserId}
                      onChange={(e) => handleSelectAppUser(e.target.value)}
                      className="w-full rounded-md border border-cyan-500/40 bg-slate-950/90 px-3 py-2 text-sm text-slate-100 shadow-[0_0_20px_rgba(8,47,73,0.9)]"
                    >
                      <option value="">
                        — Select existing portal customer (optional) —
                      </option>
                      {filteredAppUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name && u.full_name.trim().length > 0
                            ? u.full_name
                            : inferFullNameFromEmail(u.email)}{" "}
                          · {u.email}
                        </option>
                      ))}
                    </select>

                    <p className="text-[11px] text-slate-500">
                      This doesn&apos;t change the warranty logic — it just
                      makes sure the warranty and portal account use the same
                      email + name so everything stays in sync.
                    </p>
                  </div>
                )}
              </div>

              {/* Customer + basic warranty info */}
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.16em] text-slate-300">
                    Customer Name
                  </Label>
                  <Input
                    placeholder="Customer full name"
                    value={form.customer_name}
                    onChange={(e) =>
                      updateField("customer_name", e.target.value)
                    }
                  />
                  <p className="text-[11px] text-slate-500">
                    Used to label their portal profile and welcome them by
                    name. If left empty, we&apos;ll infer a name from the email.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.16em] text-slate-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    Customer Email
                  </Label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={form.customer_email}
                    onChange={(e) =>
                      updateField("customer_email", e.target.value)
                    }
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Must match the email you&apos;ll send the magic login link
                    to.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.16em] text-slate-300">
                    Warranty Number (optional)
                  </Label>
                  <Input
                    placeholder="Auto or shop warranty #"
                    value={form.warranty_number}
                    onChange={(e) =>
                      updateField("warranty_number", e.target.value)
                    }
                  />
                  <p className="text-[11px] text-slate-500">
                    Leave empty to auto-generate a unique Glass Guardian
                    warranty number from the service date &amp; customer.
                  </p>
                </div>
              </div>

              {/* Vehicle */}
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-300 flex items-center gap-2">
                  <Car className="w-4 h-4 text-sky-400" />
                  Vehicle
                </p>
                <div className="grid md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Year</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={form.vehicle_year}
                      onChange={(e) =>
                        updateField("vehicle_year", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Make</Label>
                    <Input
                      value={form.vehicle_make}
                      onChange={(e) =>
                        updateField("vehicle_make", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Model</Label>
                    <Input
                      value={form.vehicle_model}
                      onChange={(e) =>
                        updateField("vehicle_model", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Plate</Label>
                    <Input
                      value={form.vehicle_plate}
                      onChange={(e) =>
                        updateField("vehicle_plate", e.target.value)
                      }
                      className="uppercase tracking-[0.18em]"
                    />
                  </div>
                </div>
              </div>

              {/* Service + coverage */}
              <div className="grid md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.16em] text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    Service Date
                  </Label>
                  <Input
                    type="date"
                    value={form.service_date}
                    onChange={(e) =>
                      updateField("service_date", e.target.value)
                    }
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Used to auto-calculate warranty expiration for 1-year and
                    2-year coverage.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.16em] text-slate-300">
                    Coverage Type
                  </Label>
                  <select
                    value={form.coverage_type}
                    onChange={(e) =>
                      updateField(
                        "coverage_type",
                        e.target.value as (typeof form)["coverage_type"]
                      )
                    }
                    className="w-full rounded-md px-2.5 py-2 text-sm"
                  >
                    <option value="2_year">2-Year from Service Date</option>
                    <option value="1_year">1-Year from Service Date</option>
                    <option value="lifetime">Lifetime (no expiration)</option>
                    <option value="limited">Limited (no expiration)</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    1-year &amp; 2-year are calculated from the Service Date
                    automatically.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.16em] text-slate-300">
                    Expiration
                  </Label>
                  <div className="rounded-md border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-[12px] text-slate-300">
                    {form.service_date ? (
                      <>
                        {form.coverage_type === "2_year" &&
                          `Will be set to 2 years after ${form.service_date}.`}
                        {form.coverage_type === "1_year" &&
                          `Will be set to 1 year after ${form.service_date}.`}
                        {(form.coverage_type === "lifetime" ||
                          form.coverage_type === "limited") &&
                          "No expiration date will be stored for this warranty."}
                      </>
                    ) : (
                      "Select a service date first to preview expiration."
                    )}
                  </div>
                </div>
              </div>

              {/* Spot repaired – map picker */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.16em] text-slate-300 flex items_center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  Spot Repaired
                </Label>
                <WindshieldSpotPicker
                  value={form.spot_location}
                  onChange={(val) => updateField("spot_location", val)}
                />
              </div>

              {/* Service performed + notes */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.16em] text-slate-300">
                  Service Performed
                </Label>
                <Input
                  value={form.service_performed}
                  onChange={(e) =>
                    updateField("service_performed", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.16em] text-slate-300">
                  Internal Notes (optional)
                </Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className="min-h-[80px]"
                  placeholder="Chip size, crack length, resin type, anything useful for future visits..."
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/40 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {successId && !error && (
                <p className="text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-500/40 rounded-md px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Warranty created. You can now generate a magic login link for
                  this email and they&apos;ll see it in their portal.
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-6 shadow-[0_0_30px_rgba(34,211,238,0.75)]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Warranty…
                    </>
                  ) : (
                    "Create Warranty"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 🔥 Force night-mode inputs just for this page */}
      <style jsx global>{`
        .gg-warranty-dark input,
        .gg-warranty-dark textarea,
        .gg-warranty-dark select {
          background-color: rgba(2, 6, 23, 0.95) !important; /* slate-950 */
          color: #e2e8f0 !important; /* slate-200 */
          border-color: #334155 !important; /* slate-700 */
        }

        .gg-warranty-dark input::placeholder,
        .gg-warranty-dark textarea::placeholder {
          color: #64748b !important; /* slate-500 */
        }

        .gg-warranty-dark input:focus,
        .gg-warranty-dark textarea:focus,
        .gg-warranty-dark select:focus {
          outline: none !important;
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.6) !important;
          border-color: rgba(56, 189, 248, 0.8) !important; /* cyan-400 */
        }

        .gg-warranty-dark option {
          background-color: #020617;
          color: #e2e8f0;
        }
      `}</style>
    </div>
  );
}