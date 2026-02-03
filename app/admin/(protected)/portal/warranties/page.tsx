// app/admin/(protected)/portal/warranties/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Shield,
  Search,
  Mail,
  Car,
  Calendar,
  MapPin,
  AlertTriangle,
  Clock,
  ArrowRight,
} from "lucide-react";

import { GenerateMagicLinkButton } from "@/components/admin/GenerateMagicLinkButton";

type AnyObj = Record<string, any>;

type WarrantyRow = {
  id: string;
  warranty_number?: string | null;
  customer_email?: string | null;
  status?: string | null;

  service_performed?: string | null;
  service_date?: string | null;
  coverage_type?: string | null;
  expiration_date?: string | null;

  qr_code_url?: string | null;

  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_plate?: string | null;

  spot_location?: string | null;
  notes?: string | null;

  created_at?: string | null;
};

function getStatusColor(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();

  const colors: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-100 border-emerald-400/60",
    claimed: "bg-sky-500/15 text-sky-100 border-sky-400/60",
    expired: "bg-slate-700/40 text-slate-200 border-slate-500/70",
    transferred: "bg-violet-500/15 text-violet-100 border-violet-400/60",
    voided: "bg-rose-500/15 text-rose-100 border-rose-400/70",
  };
  return (
    colors[normalized] ||
    "bg-slate-700/50 text-slate-200 border-slate-500/70"
  );
}

/** ---- data fetchers (no SQL writes; reads only) ---- */
async function fetchWarranties(): Promise<WarrantyRow[]> {
  const { data, error } = await supabaseClient
    .from("warranties")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WarrantyRow[];
}

export default function AdminWarrantiesPage() {
  const [search, setSearch] = React.useState("");

  const { data: warranties = [], isLoading } = useQuery({
    queryKey: ["admin:warranties:list"],
    queryFn: fetchWarranties,
    staleTime: 15_000,
  });

  const openWarranties = React.useMemo(() => {
    return warranties.filter((w) => {
      const s = (w.status ?? "").toLowerCase();
      if (s === "expired" || s === "voided") return false;
      return true;
    });
  }, [warranties]);

  const expiringSoon = React.useMemo(() => {
    const now = new Date();
    const in30 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 30
    );
    return openWarranties.filter((w) => {
      if (!w.expiration_date) return false;
      const d = new Date(w.expiration_date);
      return d >= now && d <= in30;
    });
  }, [openWarranties]);

  const filtered = React.useMemo(() => {
    if (!search) return openWarranties;
    const q = search.toLowerCase();
    return openWarranties.filter((w) => {
      const email = String(w.customer_email ?? "").toLowerCase();
      const wn = String(w.warranty_number ?? "").toLowerCase();
      const vehicle = (
        (w.vehicle_year ? w.vehicle_year + " " : "") +
        (w.vehicle_make ?? "") +
        " " +
        (w.vehicle_model ?? "")
      )
        .trim()
        .toLowerCase();
      return (
        email.includes(q) ||
        wn.includes(q) ||
        vehicle.includes(q)
      );
    });
  }, [openWarranties, search]);

  const total = warranties.length;
  const openCount = openWarranties.length;
  const expiringCount = expiringSoon.length;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[radial-gradient(circle_at_top,_#020617_0,_#020617_45%,_#000000_100%)] text-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/35 blur-xl" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-600 shadow-[0_0_35px_rgba(16,185,129,0.85)]">
                <Shield className="w-6 h-6 text-slate-950" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Warranty Registry
              </h1>
              <p className="text-sm text-slate-400">
                View all open Glass Guardian warranties, their vehicles, and repair spots.
              </p>
            </div>
          </div>

          {/* New warranty CTA */}
          <div className="flex items-center gap-2">
            <Link href="/admin/portal/warranties/new">
              <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-[0_0_35px_rgba(16,185,129,0.8)]">
                New Warranty
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6 border border-emerald-500/15 bg-slate-950/80 backdrop-blur-xl shadow-[0_0_40px_rgba(6,95,70,0.85)]">
          <CardContent className="p-4 md:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search open warranties by email, vehicle, or warranty number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-950/80 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:border-emerald-400/70"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="border border-emerald-500/25 bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-slate-950/80 backdrop-blur-xl shadow-[0_0_55px_rgba(16,185,129,0.7)]">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/90 mb-1 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                Open Warranties
              </p>
              <p className="text-3xl font-semibold text-emerald-50">
                {openCount}
              </p>
              <p className="text-[11px] text-emerald-100/80 mt-1">
                Active / non-voided warranties currently on file.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-sky-500/25 bg-gradient-to-br from-sky-500/25 via-sky-500/10 to-slate-950/80 backdrop-blur-xl shadow-[0_0_55px_rgba(56,189,248,0.7)]">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sky-100/90 mb-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Total Warranties
              </p>
              <p className="text-3xl font-semibold text-sky-50">
                {total}
              </p>
              <p className="text-[11px] text-sky-100/80 mt-1">
                Includes expired, transferred, and voided records.
              </p>
            </CardContent>
          </Card>

          <Card className="border border-amber-400/25 bg-gradient-to-br from-amber-400/25 via-orange-500/10 to-slate-950/80 backdrop-blur-xl shadow-[0_0_55px_rgba(245,158,11,0.7)]">
            <CardContent className="p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-50/90 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Expiring in 30 Days
              </p>
              <p className="text-3xl font-semibold text-amber-50">
                {expiringCount}
              </p>
              <p className="text-[11px] text-amber-100/80 mt-1">
                Great candidates for proactive follow-up or upsell.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="py-24 text-center text-slate-400">
            <div className="mx-auto h-10 w-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_22px_rgba(16,185,129,0.8)]" />
            Loading warranty registry…
          </div>
        )}

        {/* List */}
        {!isLoading && (
          <div className="space-y-4">
            {filtered.map((w) => {
              const status = (w.status ?? "active").toLowerCase();
              const serviceDate = w.service_date
                ? format(new Date(w.service_date), "MMM d, yyyy")
                : "—";

              const expirationDate = w.expiration_date
                ? format(new Date(w.expiration_date), "MMM d, yyyy")
                : "Lifetime";

              const vehicleLabel =
                (w.vehicle_year ? `${w.vehicle_year} ` : "") +
                (w.vehicle_make ?? "") +
                (w.vehicle_make || w.vehicle_model ? " " : "") +
                (w.vehicle_model ?? "");

              const plateLabel = w.vehicle_plate ?? "";

              const statusLabel = String(w.status ?? "active")
                .replace(/_/g, " ")
                .toUpperCase();

              const coverageLabel = String(w.coverage_type ?? "lifetime")
                .replace(/_/g, " ")
                .toLowerCase();

              return (
                <Card
                  key={w.id}
                  className="border border-slate-700/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_0_45px_rgba(15,23,42,0.95)] hover:border-emerald-400/70 hover:shadow-[0_0_70px_rgba(16,185,129,0.55)] transition-all duration-300"
                >
                  <CardContent className="p-5 md:p-6 space-y-4">
                    {/* Top row: meta */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl" />
                          <div className="relative h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-sky-600 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.8)]">
                            <Shield className="w-5 h-5 text-slate-950" />
                          </div>
                        </div>
                        <div>
                          <CardTitle className="text-base md:text-lg text-slate-50">
                            Warranty #{w.warranty_number ?? w.id}
                          </CardTitle>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge
                              className={`text-[10px] font-semibold uppercase tracking-[0.14em] border ${getStatusColor(
                                w.status
                              )}`}
                            >
                              {statusLabel}
                            </Badge>
                            <span className="text-[11px] text-slate-400">
                              Created{" "}
                              {w.created_at
                                ? format(
                                    new Date(w.created_at),
                                    "MMM d, yyyy"
                                  )
                                : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 items-center justify-end">
                        <Link href={`/admin/portal/warranties/${w.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-600/80 bg-slate-900/80 text-slate-100 hover:border-emerald-400 hover:text-emerald-100 hover:bg-slate-900"
                          >
                            Open
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>

                        {w.customer_email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              window.location.href = `mailto:${w.customer_email}`;
                            }}
                            className="border-slate-600/80 bg-slate-900/80 text-slate-100 hover:border-emerald-400 hover:text-emerald-100 hover:bg-slate-900 shadow-[0_0_18px_rgba(15,23,42,0.9)]"
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Contact
                          </Button>
                        )}

                        {w.customer_email && (
                          <GenerateMagicLinkButton
                            email={w.customer_email}
                            warrantyId={w.id}
                          />
                        )}
                      </div>
                    </div>

                    {/* Middle: customer + vehicle + spot */}
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Customer */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-cyan-400" />
                          Customer
                        </p>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                          <p className="text-slate-100 break-all">
                            {w.customer_email ?? "No email on file"}
                          </p>
                        </div>
                      </div>

                      {/* Vehicle */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                          <Car className="w-3 h-3 text-sky-400" />
                          Vehicle
                        </p>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm space-y-1">
                          <p className="text-slate-100">
                            {vehicleLabel.trim().length > 0
                              ? vehicleLabel
                              : "Vehicle on file"}
                          </p>
                          {plateLabel && (
                            <p className="text-[11px] text-slate-400">
                              Plate:{" "}
                              <span className="inline-flex items-center rounded-md border border-slate-600 px-1.5 py-0.5 uppercase tracking-[0.18em] text-[0.68rem]">
                                {plateLabel}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Spot repaired */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          Spot repaired
                        </p>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                          <p className="text-slate-100">
                            {w.spot_location
                              ? w.spot_location
                              : "Spot description on file (from tech map)"}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Tied to the tech&apos;s windshield map and invoice.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: service / coverage / expiration */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-cyan-400" />
                          Service date
                        </p>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                          <p className="text-slate-100">{serviceDate}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Day the original repair was performed.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                          <Shield className="w-3 h-3 text-emerald-400" />
                          Coverage
                        </p>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                          <p className="text-slate-100 capitalize">
                            {coverageLabel}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Based on your shop warranty terms.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          Expiration
                        </p>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2.5 text-sm">
                          <p className="text-slate-100">{expirationDate}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Leave blank for lifetime-style coverage.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Highlight if active */}
                    {status === "active" && (
                      <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3">
                        <p className="text-sm text-emerald-100">
                          ✓ This warranty is currently active. If the damage
                          spreads or reappears in this same spot, the customer
                          can file a claim directly from their portal.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <Card className="border border-dashed border-slate-700/80 bg-slate-950/80 backdrop-blur-xl">
                <CardContent className="py-16 text-center">
                  <Shield className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">
                    No open warranties match your search
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Try searching by customer email, warranty number, or vehicle details.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}