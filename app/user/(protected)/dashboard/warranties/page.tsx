"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Shield,
  CheckCircle,
  Download,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  // optional vehicle / spot fields
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  vehicle_plate?: string | null;
  spot_location?: string | null;

  [key: string]: any;
};

function getStatusColor(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();

  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-300",
    claimed: "bg-blue-100 text-blue-800 border-blue-300",
    expired: "bg-gray-100 text-gray-800 border-gray-300",
    transferred: "bg-purple-100 text-purple-800 border-purple-300",
    voided: "bg-red-100 text-red-800 border-red-300",
  };
  return colors[normalized] || "bg-gray-100 text-gray-800 border-gray-300";
}

export default function MyWarrantiesPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState<string | null>(null);

  // Ensure authenticated user (redirect to login if missing)
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!session?.user) {
        router.replace(
          `/user/login?redirect=${encodeURIComponent(
            "/user/dashboard/warranties"
          )}`
        );
        return;
      }
      setEmail(session.user.email ?? null);
    })();
  }, [router]);

  const {
    data: warranties = [],
    isLoading,
    isError,
  } = useQuery<WarrantyRow[]>({
    queryKey: ["my-warranties", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("warranties")
        .select("*")
        .eq("customer_email", email)
        .order("service_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as WarrantyRow[];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-14 w-14 rounded-full bg-sky-500/30 blur-xl" />
          <div className="absolute h-20 w-20 rounded-full border border-sky-400/40 animate-spin-slow" />
          <div className="relative h-10 w-10 rounded-full border-b-2 border-sky-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <Card className="max-w-md w-full border border-slate-800/80 bg-slate-900/90 backdrop-blur-xl shadow-[0_22px_60px_rgba(15,23,42,0.95)]">
          <CardContent className="py-10 text-center space-y-4">
            <h2 className="text-xl font-bold text-slate-50 mb-1">Something went wrong</h2>
            <p className="text-sm text-slate-300">
              We couldn&apos;t load your warranties. Please refresh or try again in a moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCount = warranties.filter(
    (w) => (w.status ?? "").toLowerCase() === "active"
  ).length;

  return (
    <div className="relative min-h-screen bg-slate-950 px-4 py-8 md:px-8 text-slate-50 overflow-hidden">
      {/* 3D ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-32 h-[26rem] w-[26rem] rounded-full bg-sky-500/18 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/16 blur-3xl" />
        <div className="absolute left-1/4 bottom-[-8rem] h-[22rem] w-[22rem] rounded-full bg-indigo-500/18 blur-3xl" />

        <div className="absolute inset-0 opacity-40 mix-blend-soft-light bg-[radial-gradient(circle_at_top,#1e293b_0,transparent_55%),radial-gradient(circle_at_bottom,#020617_0,transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(220deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[length:120px_120px]" />

        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 preserveAspectRatio=%22none%22 width=%22128%22 height=%22128%22 viewBox=%220 0 128 128%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/></filter><rect width=%22128%22 height=%22128%22 filter=%22url(%23n)%22 opacity=%220.4%22/></svg>')",
          }}
        />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Header + hero card */}
        <section className="space-y-4">
          <div className="flex flex-col gap-2">
            <h1 className="flex items-center gap-3 text-3xl md:text-4xl font-semibold tracking-tight text-slate-50">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-sky-400 to-cyan-400 shadow-[0_18px_40px_rgba(56,189,248,0.65)]">
                <Shield className="h-6 w-6 text-slate-950" />
              </span>
              My Warranties
            </h1>
            <p className="text-sm md:text-base text-slate-300">
              Every repair you&apos;ve done with us, protected and easy to pull up
              roadside, at the shop, or from your couch.
            </p>
          </div>

          {/* 3D hero “glass tile” */}
          <div className="relative group">
            <div className="absolute -inset-[1.5px] rounded-3xl bg-[conic-gradient(from_140deg_at_50%_50%,rgba(56,189,248,0.85),transparent_28%,rgba(16,185,129,0.85),transparent_70%,rgba(129,140,248,0.9))] opacity-60 blur-[3px] group-hover:opacity-100 transition-opacity duration-300" />
            <Card className="relative rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-950/90 via-slate-900/92 to-slate-950/92 shadow-[0_22px_60px_rgba(15,23,42,0.98)] backdrop-blur-2xl">
              <CardContent className="px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Left: warranty story */}
                <div className="space-y-3 max-w-xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-200 border border-emerald-500/40">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-300" />
                    1 Year Warranty Protection
                  </div>
                  <h2 className="text-lg md:text-xl font-semibold text-slate-50">
                    Glass work that stays protected after the tech leaves.
                  </h2>
                  <p className="text-sm md:text-[0.95rem] text-slate-300 leading-relaxed">
                    Every chip and crack repair includes a 1 Year Warranty. If the damage
                    spreads or worsens and it&apos;s still repairable, we&apos;ll repair it
                    again at no cost — or refund the payment to the payee when it can&apos;t be saved.
                  </p>
                  <div className="grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                    <div className="space-y-1">
                      <p>✓ Covers workmanship &amp; materials</p>
                      <p>✓ Valid 1 year from date of service</p>
                    </div>
                    <div className="space-y-1">
                      <p>✓ Transferable to new vehicle owners</p>
                      <p>✓ No deductible when insurance covers repair</p>
                    </div>
                  </div>
                </div>

                {/* Right: tiny stat + 3D badge */}
                <div className="flex flex-col items-end gap-3 min-w-[180px]">
                  <div className="relative">
                    <div className="absolute -inset-2 rounded-2xl bg-emerald-400/20 blur-xl" />
                    <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-400 via-sky-400 to-cyan-400 shadow-[0_20px_45px_rgba(56,189,248,0.8)]">
                      <div className="h-12 w-12 rounded-xl bg-slate-950/90 flex flex-col items-center justify-center text-emerald-100 border border-emerald-300/60 shadow-[0_8px_22px_rgba(15,23,42,0.95)]">
                        <span className="text-xs font-semibold tracking-[0.18em] uppercase">
                          Active
                        </span>
                        <span className="text-xl font-bold leading-none">
                          {activeCount}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[0.75rem] text-slate-300 text-right max-w-[180px] leading-snug">
                    You can pull up any warranty by tapping into the cards below.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Empty state vs grid */}
        {warranties.length === 0 ? (
          <Card className="mt-2 rounded-3xl border-2 border-dashed border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
            <CardContent className="py-14 px-6 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.95)]">
                <Shield className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-50">
                No warranties on file yet
              </h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Warranties are issued automatically after each completed repair. Book
                a service, and your coverage will show up here as soon as it&apos;s done.
              </p>
              <div className="pt-2">
                <Link href="/user/dashboard/appointments">
                  <Button className="rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.8)] hover:opacity-95">
                    View appointments
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <section className="mt-2 grid gap-6 md:grid-cols-2">
            {warranties.map((warranty) => {
              const status = (warranty.status ?? "active").toLowerCase();
              const isActive = status === "active";

              const coverageLabel = String(
                warranty.coverage_type ?? "lifetime"
              )
                .replace(/_/g, " ")
                .toLowerCase();

              const serviceDate = warranty.service_date
                ? format(new Date(warranty.service_date), "MMM d, yyyy")
                : null;

              const expirationDate = warranty.expiration_date
                ? format(new Date(warranty.expiration_date), "MMM d, yyyy")
                : null;

              const vehicleBits = [
                warranty.vehicle_year ? `${warranty.vehicle_year}` : "",
                warranty.vehicle_make ?? "",
                warranty.vehicle_model ?? "",
              ]
                .join(" ")
                .trim();

              return (
                <Card
                  key={warranty.id}
                  className="group relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 text-slate-50 shadow-[0_22px_60px_rgba(15,23,42,0.98)] backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-1.5 hover:shadow-[0_26px_70px_rgba(15,23,42,1)]"
                >
                  {/* subtle top light streak */}
                  <div className="pointer-events-none absolute inset-x-0 -top-10 h-24 bg-gradient-to-b from-white/10 via-white/0 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />

                  <CardHeader className="relative pb-3 z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="absolute -inset-1 rounded-2xl bg-emerald-400/20 blur-md" />
                          <div
                            className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border ${
                              isActive
                                ? "border-emerald-300/70 bg-gradient-to-br from-emerald-500 to-emerald-400"
                                : "border-slate-500/60 bg-gradient-to-br from-slate-500 to-slate-400"
                            } shadow-[0_14px_30px_rgba(15,23,42,0.9)]`}
                          >
                            <Shield className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div>
                          <CardTitle className="text-base md:text-lg">
                            Warranty #{warranty.warranty_number ?? warranty.id}
                          </CardTitle>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Glass Guardian repair coverage
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`mt-1 border text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${getStatusColor(
                          warranty.status
                        )}`}
                      >
                        {String(warranty.status ?? "active")
                          .replace(/_/g, " ")
                          .toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10 space-y-3 pb-4">
                    {/* Main info block */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3.5 py-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Service</span>
                        <span className="font-medium text-slate-50 text-right">
                          {warranty.service_performed ?? "Windshield repair"}
                        </span>
                      </div>
                      {serviceDate && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Service date</span>
                          <span className="font-medium text-slate-50">
                            {serviceDate}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Coverage</span>
                        <span className="font-medium capitalize text-slate-50">
                          {coverageLabel}
                        </span>
                      </div>
                      {expirationDate && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Expires</span>
                          <span className="font-medium text-slate-50">
                            {expirationDate}
                          </span>
                        </div>
                      )}

                      {/* Vehicle hint */}
                      {(vehicleBits || warranty.vehicle_plate) && (
                        <div className="pt-2 mt-1 border-t border-slate-800 text-xs text-slate-300 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200">
                              Vehicle
                            </span>
                            <span className="truncate text-right">
                              {vehicleBits || "On file"}
                            </span>
                          </div>
                          {warranty.vehicle_plate && (
                            <div className="flex justify-end">
                              <span className="inline-flex items-center rounded-md border border-slate-600 px-1.5 py-0.5 uppercase tracking-[0.16em] text-[0.7rem]">
                                {warranty.vehicle_plate}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Active status highlight */}
                    {isActive && (
                      <div className="rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-3.5 py-2.5">
                        <p className="text-xs md:text-sm text-emerald-100 font-medium">
                          ✓ This repair is currently covered. If the damage spreads or
                          reappears in the same spot, mention this warranty number when you contact us.
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {warranty.qr_code_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl border-slate-600 bg-slate-900/80 text-slate-100 hover:bg-slate-800 hover:text-slate-50"
                          asChild
                        >
                          <a
                            href={warranty.qr_code_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download QR
                          </a>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-xl border-sky-500/60 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"
                        asChild
                      >
                        <Link
                          href={`/user/dashboard/warranties/warranty/${encodeURIComponent(
                            warranty.id
                          )}`}
                        >
                          View warranty
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}