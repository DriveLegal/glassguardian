// app/tech/(protected)/dashboard/vehicles/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";

import { supabaseClient } from "@/lib/supabaseClient";
import { getTechIdentity } from "@/lib/techAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { TechToast, TechToastState } from "@/components/tech/TechToast";

import {
  Car,
  Users,
  Plus,
  Search,
  Mail,
  Palette,
  Hash,
  Calendar as CalendarIcon,
  AlertCircle,
} from "lucide-react";

type AnyObj = Record<string, any>;

type VehicleRow = {
  id: string;
  owner_email: string;
  make: string;
  model: string;
  year: number;
  license_plate: string | null;
  color: string | null;
  body_type: string | null;
  vin: string | null;
  insurance_carrier: string | null;
  is_default: boolean;
  created_at: string | null;
  updated_at?: string | null;
};

type EmailOption = {
  value: string;
  label: string;
};

type NewVehicleForm = {
  make: string;
  model: string;
  year: string;
  license_plate: string;
  color: string;
  body_type: string;
  vin: string;
  insurance_carrier: string;
};

/* Small helper: nice label for body type */
function prettyBody(body: string | null): string {
  if (!body) return "Vehicle";
  const b = body.toLowerCase();
  if (b === "suv") return "SUV";
  if (b === "pickup") return "Pickup Truck";
  if (b === "stationwagon") return "Station Wagon";
  if (b === "sportscar") return "Sportscar";
  if (b === "crossover") return "Crossover";
  if (b === "minivan") return "Minivan";
  if (b === "convertible") return "Convertible";
  if (b === "hatchback") return "Hatchback";
  if (b === "hybrid") return "Hybrid / Electric";
  return b.charAt(0).toUpperCase() + b.slice(1);
}

/* Glass helper */
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

export default function TechVehiclesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const [techEmail, setTechEmail] = React.useState<string | null>(null);

  // Add-vehicle dialog state
  const [addOpen, setAddOpen] = React.useState(false);
  const [ownerEmailOption, setOwnerEmailOption] = React.useState<string>("");
  const [customEmail, setCustomEmail] = React.useState<string>("");
  const [newVehicleForm, setNewVehicleForm] = React.useState<NewVehicleForm>({
    make: "",
    model: "",
    year: "",
    license_plate: "",
    color: "",
    body_type: "",
    vin: "",
    insurance_carrier: "",
  });
  const [localFormError, setLocalFormError] = React.useState<string | null>(null);

  const [searchTerm, setSearchTerm] = React.useState("");

  const [toast, setToast] = React.useState<TechToastState>({
    open: false,
    title: "",
    message: "",
    variant: "info",
  });

  /* ---------- Auth ---------- */
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await getTechIdentity();
      if (!mounted) return;

      if (!id) {
        router.replace(
          `/tech/login?redirect=${encodeURIComponent("/tech/dashboard/vehicles")}`
        );
        return;
      }

      setTechEmail(id.email);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  /* ---------- Fetch vehicles ---------- */
  const {
    data: vehicles = [],
    isLoading: loadingVehicles,
    error: vehiclesError,
  } = useQuery({
    queryKey: ["tech-vehicles"],
    queryFn: async (): Promise<VehicleRow[]> => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as VehicleRow[];
    },
    staleTime: 10_000,
  });

  /* ---------- Fetch known customer emails (dropdown) ---------- */
  const {
    data: customerEmails = [],
    error: emailError,
  } = useQuery({
    queryKey: ["tech-customer-emails"],
    queryFn: async (): Promise<EmailOption[]> => {
      // Prefer appointments table used elsewhere. If you truly use user_appointments, keep it.
      const [aptRes, vehRes] = await Promise.all([
        supabaseClient
          .from("appointments")
          .select("customer_email")
          .not("customer_email", "is", null)
          .limit(400),
        supabaseClient
          .from("vehicles")
          .select("owner_email")
          .not("owner_email", "is", null)
          .limit(400),
      ]);

      const emails = new Set<string>();

      if (!aptRes.error && aptRes.data) {
        for (const row of aptRes.data as AnyObj[]) {
          const e = (row.customer_email ?? "").trim().toLowerCase();
          if (e) emails.add(e);
        }
      }

      if (!vehRes.error && vehRes.data) {
        for (const row of vehRes.data as AnyObj[]) {
          const e = (row.owner_email ?? "").trim().toLowerCase();
          if (e) emails.add(e);
        }
      }

      return Array.from(emails)
        .sort()
        .map((e) => ({ value: e, label: e }));
    },
    staleTime: 30_000,
  });

  /* ---------- Create vehicle mutation ---------- */
  const createVehicleMutation = useMutation({
    mutationFn: async (payload: {
      owner_email: string;
      make: string;
      model: string;
      year: number;
      license_plate: string | null;
      color: string | null;
      body_type: string | null;
      vin: string | null;
      insurance_carrier: string | null;
    }) => {
      const { error } = await supabaseClient.from("vehicles").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-vehicles"] });

      setAddOpen(false);
      setOwnerEmailOption("");
      setCustomEmail("");
      setNewVehicleForm({
        make: "",
        model: "",
        year: "",
        license_plate: "",
        color: "",
        body_type: "",
        vin: "",
        insurance_carrier: "",
      });
      setLocalFormError(null);

      setToast({
        open: true,
        variant: "success",
        title: "Vehicle saved",
        message: "Vehicle is now linked to that customer email.",
      });
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to create vehicle.";
      setLocalFormError(msg);
      setToast({ open: true, variant: "error", title: "Save failed", message: msg });
    },
  });

  const totalVehicles = vehicles.length;
  const uniqueOwners = React.useMemo(() => {
    const set = new Set(
      vehicles
        .map((v) => (v.owner_email ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
    return set.size;
  }, [vehicles]);

  const recentVehicles = vehicles.slice(0, 5);

  const filteredVehicles = React.useMemo(() => {
    if (!searchTerm.trim()) return vehicles;
    const q = searchTerm.toLowerCase();
    return vehicles.filter((v) => {
      const make = (v.make ?? "").toLowerCase();
      const model = (v.model ?? "").toLowerCase();
      const plate = (v.license_plate ?? "").toLowerCase();
      const email = (v.owner_email ?? "").toLowerCase();
      const color = (v.color ?? "").toLowerCase();
      const vin = (v.vin ?? "").toLowerCase();
      const ins = (v.insurance_carrier ?? "").toLowerCase();
      return (
        make.includes(q) ||
        model.includes(q) ||
        plate.includes(q) ||
        email.includes(q) ||
        color.includes(q) ||
        vin.includes(q) ||
        ins.includes(q)
      );
    });
  }, [vehicles, searchTerm]);

  const resolvedOwnerEmail = React.useMemo(() => {
    const base = ownerEmailOption === "__custom__" ? customEmail : ownerEmailOption;
    return base.trim().toLowerCase();
  }, [ownerEmailOption, customEmail]);

  const canCreateVehicle =
    !!resolvedOwnerEmail &&
    !!newVehicleForm.make.trim() &&
    !!newVehicleForm.model.trim() &&
    !!newVehicleForm.year.trim() &&
    !createVehicleMutation.isPending;

  const handleCreateVehicle: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    setLocalFormError(null);

    const email = resolvedOwnerEmail;
    if (!email) return setLocalFormError("Customer email is required.");

    const trimmedMake = newVehicleForm.make.trim();
    const trimmedModel = newVehicleForm.model.trim();
    const trimmedYear = newVehicleForm.year.trim();
    if (!trimmedMake || !trimmedModel || !trimmedYear) {
      return setLocalFormError("Make, model, and year are required.");
    }

    const yearVal = parseInt(trimmedYear, 10);
    if (Number.isNaN(yearVal) || yearVal < 1900 || yearVal > 2100) {
      return setLocalFormError("Please enter a valid 4-digit year.");
    }

    createVehicleMutation.mutate({
      owner_email: email,
      make: trimmedMake,
      model: trimmedModel,
      year: yearVal,
      license_plate: newVehicleForm.license_plate.trim() || null,
      color: newVehicleForm.color.trim() || null,
      body_type: newVehicleForm.body_type.trim() || null,
      vin: newVehicleForm.vin.trim() || null,
      insurance_carrier: newVehicleForm.insurance_carrier.trim() || null,
    });
  };

  return (
    <div className="space-y-6">
      <TechToast
  toast={toast}
  onCloseAction={() => setToast((t) => ({ ...t, open: false }))}
 />
 
      {/* Header */}
      <GlassPanel className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[0.65rem] tracking-[0.25em] uppercase text-cyan-200/80">
              Glass Guardian · Tech
            </p>
            <h2 className="mt-1 text-2xl md:text-3xl font-extrabold flex items-center gap-2 text-slate-50">
              Vehicle Garage (All Customers)
              <Car className="w-5 h-5 text-cyan-300" />
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              View every vehicle, attach new vehicles by email, and keep garages accurate even before customers sign up.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end text-[11px] text-slate-400">
              <span className="uppercase tracking-[0.18em]">Signed in</span>
              <span className="text-slate-200 font-medium">
                {techEmail || "Technician"}
              </span>
            </div>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-500 text-slate-950 border border-sky-300 shadow-[0_0_24px_rgba(56,189,248,0.7)]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vehicle
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-lg border border-slate-700 bg-slate-950 text-slate-100">
                <DialogHeader>
                  <DialogTitle className="text-slate-50">
                    Add Vehicle to Customer Garage
                  </DialogTitle>
                </DialogHeader>

                {(emailError || createVehicleMutation.isError || localFormError) && (
                  <div className="mt-3 mb-2 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      {localFormError
                        ? localFormError
                        : emailError
                        ? "Failed to load customer emails."
                        : (createVehicleMutation.error as any)?.message ?? "Failed to create vehicle."}
                    </span>
                  </div>
                )}

                <form className="mt-4 space-y-4" onSubmit={handleCreateVehicle}>
                  {/* Owner email selection */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-200">
                      Connect to Customer Email
                    </Label>

                    <select
                      value={ownerEmailOption}
                      onChange={(e) => setOwnerEmailOption(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900/90 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/70"
                    >
                      <option value="">Select from known emails</option>
                      {customerEmails.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="__custom__">Type a brand new email…</option>
                    </select>

                    {ownerEmailOption === "__custom__" && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <Input
                          type="email"
                          value={customEmail}
                          onChange={(e) => setCustomEmail(e.target.value)}
                          placeholder="customer@example.com"
                          className="bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    )}

                    {ownerEmailOption !== "__custom__" && !!ownerEmailOption && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Mail className="w-3 h-3" />
                        <span>{ownerEmailOption}</span>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-500">
                      Attach a vehicle to any email. When the customer signs up later, it appears in their garage automatically.
                    </p>
                  </div>

                  {/* Vehicle details */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-200">
                        Make <span className="text-rose-400">*</span>
                      </Label>
                      <Input
                        value={newVehicleForm.make}
                        onChange={(e) => setNewVehicleForm((f) => ({ ...f, make: e.target.value }))}
                        placeholder="Toyota"
                        className="mt-1 bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-200">
                        Model <span className="text-rose-400">*</span>
                      </Label>
                      <Input
                        value={newVehicleForm.model}
                        onChange={(e) => setNewVehicleForm((f) => ({ ...f, model: e.target.value }))}
                        placeholder="Camry"
                        className="mt-1 bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-200">
                        Year <span className="text-rose-400">*</span>
                      </Label>
                      <Input
                        type="number"
                        value={newVehicleForm.year}
                        onChange={(e) => setNewVehicleForm((f) => ({ ...f, year: e.target.value }))}
                        placeholder="2020"
                        className="mt-1 bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-200">License Plate</Label>
                      <Input
                        value={newVehicleForm.license_plate}
                        onChange={(e) =>
                          setNewVehicleForm((f) => ({ ...f, license_plate: e.target.value }))
                        }
                        placeholder="ABC123"
                        className="mt-1 bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-200">Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Palette className="w-3 h-3 text-slate-400" />
                        <Input
                          value={newVehicleForm.color}
                          onChange={(e) => setNewVehicleForm((f) => ({ ...f, color: e.target.value }))}
                          placeholder="White / Silver / Blue"
                          className="bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-200">Body Type</Label>
                      <Input
                        value={newVehicleForm.body_type}
                        onChange={(e) =>
                          setNewVehicleForm((f) => ({ ...f, body_type: e.target.value }))
                        }
                        placeholder="SUV / Sedan / Truck…"
                        className="mt-1 bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-200">VIN</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Hash className="w-3 h-3 text-slate-400" />
                        <Input
                          value={newVehicleForm.vin}
                          onChange={(e) => setNewVehicleForm((f) => ({ ...f, vin: e.target.value }))}
                          placeholder="17-character VIN"
                          className="bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 uppercase"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-200">Insurance Carrier</Label>
                      <Input
                        value={newVehicleForm.insurance_carrier}
                        onChange={(e) =>
                          setNewVehicleForm((f) => ({ ...f, insurance_carrier: e.target.value }))
                        }
                        placeholder="Geico, Progressive…"
                        className="mt-1 bg-slate-900/90 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!canCreateVehicle}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 border border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.7)]"
                  >
                    {createVehicleMutation.isPending ? "Saving Vehicle…" : "Save Vehicle to Garage"}
                  </Button>

                  {!canCreateVehicle && (
                    <p className="mt-1 text-[10px] text-slate-500 text-center">
                      You need a customer email, make, model, and year.
                    </p>
                  )}
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </GlassPanel>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="border border-slate-800 bg-slate-950/70 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.95)]">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400">
                  Total Vehicles
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-50">{totalVehicles}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Across all customers</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-300 flex items-center justify-center shadow-lg shadow-sky-500/60">
                <Car className="w-5 h-5 text-slate-950" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="border border-emerald-500/60 bg-emerald-900/25 backdrop-blur-2xl shadow-[0_18px_60px_rgba(16,185,129,0.35)]">
            <CardContent className="py-4 px-5 flex items-center justify-between">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-emerald-200/80">
                  Unique Customers
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-50">{uniqueOwners}</p>
                <p className="text-[11px] text-emerald-200/70 mt-0.5">With at least one vehicle</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-lime-300 flex items-center justify-center shadow-lg shadow-emerald-500/60">
                <Users className="w-5 h-5 text-emerald-950" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Card className="border border-slate-800 bg-slate-950/70 backdrop-blur-2xl shadow-[0_18px_60px_rgba(15,23,42,0.95)]">
            <CardContent className="py-4 px-5">
              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-slate-400 mb-1">
                Recent Vehicles
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                {recentVehicles.length === 0 ? (
                  <p className="text-slate-500">New vehicles will appear here as you add them.</p>
                ) : (
                  recentVehicles.map((v) => (
                    <div key={v.id} className="flex items-center gap-2">
                      <Car className="w-3 h-3 text-sky-300" />
                      <span>{(v.year ? `${v.year} ` : "") + (v.make || "Vehicle")}</span>
                      <span className="text-slate-400 text-[10px]">{v.model || "Model not set"}</span>
                      {v.license_plate && (
                        <span className="inline-flex items-center ml-auto rounded-md border border-slate-700 px-1.5 py-[2px] text-[9px] uppercase tracking-[0.14em] text-slate-200">
                          {v.license_plate}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search + table */}
      <Card className="border border-slate-800 bg-slate-950/75 backdrop-blur-2xl shadow-[0_26px_80px_rgba(15,23,42,0.92)]">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              All Vehicles
              <span className="text-[11px] font-normal text-slate-400">
                Linked to customer emails (vehicles table)
              </span>
            </CardTitle>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by make, model, plate, VIN, email…"
                  className="pl-8 bg-slate-900/80 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {vehiclesError && (
            <div className="m-4 flex items-center gap-2 rounded-md border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-xs text-rose-100">
              <AlertCircle className="w-4 h-4" />
              <span>{(vehiclesError as any)?.message ?? "Failed to load vehicles."}</span>
            </div>
          )}

          {loadingVehicles ? (
            <div className="py-10 flex flex-col items-center gap-2 text-xs text-slate-400">
              <div className="h-7 w-7 rounded-full border-2 border-cyan-400/70 border-t-transparent animate-spin" />
              <span className="tracking-[0.25em] uppercase">Loading garages</span>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border-t border-slate-800">
              <Car className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              No vehicles found.
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-slate-800">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-950/80">
                  <tr className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    <th className="px-4 py-2 text-left">Vehicle</th>
                    <th className="px-4 py-2 text-left">Plate</th>
                    <th className="px-4 py-2 text-left">Color</th>
                    <th className="px-4 py-2 text-left">Body</th>
                    <th className="px-4 py-2 text-left">VIN</th>
                    <th className="px-4 py-2 text-left">Insurance</th>
                    <th className="px-4 py-2 text-left">Owner Email</th>
                    <th className="px-4 py-2 text-left">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v, idx) => {
                    const plate = v.license_plate || "";
                    const created =
                      v.created_at && !Number.isNaN(new Date(v.created_at).getTime())
                        ? format(new Date(v.created_at), "MMM d, yyyy")
                        : "—";

                    return (
                      <tr
                        key={v.id}
                        className={`border-t border-slate-800/70 ${
                          idx % 2 === 0 ? "bg-slate-950/60" : "bg-slate-950/35"
                        }`}
                      >
                        <td className="px-4 py-2 align-middle">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-100">
                              {(v.year ? `${v.year} ` : "") + (v.make || "Vehicle")}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {v.model || "Model not set"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-2 align-middle">
                          {plate ? (
                            <Badge className="bg-slate-900/70 border-slate-600 text-[10px] uppercase tracking-[0.14em] px-2 py-0.5">
                              {plate}
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-slate-500">—</span>
                          )}
                        </td>

                        <td className="px-4 py-2 align-middle">
                          <div className="flex items-center gap-1.5">
                            {v.color && (
                              <span className="inline-block w-3 h-3 rounded-full border border-slate-600 bg-slate-900" />
                            )}
                            <span className="text-[11px] text-slate-200">{v.color || "—"}</span>
                          </div>
                        </td>

                        <td className="px-4 py-2 align-middle">
                          <span className="text-[11px] text-slate-200">{prettyBody(v.body_type)}</span>
                        </td>

                        <td className="px-4 py-2 align-middle">
                          <span className="text-[11px] text-slate-200">{v.vin || "—"}</span>
                        </td>

                        <td className="px-4 py-2 align-middle">
                          <span className="text-[11px] text-slate-200">{v.insurance_carrier || "—"}</span>
                        </td>

                        <td className="px-4 py-2 align-middle">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span className="text-[11px] text-slate-200">
                              {v.owner_email || "Not linked"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-2 align-middle">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <CalendarIcon className="w-3 h-3 text-slate-500" />
                            <span>{created}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}