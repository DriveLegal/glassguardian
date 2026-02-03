// app/admin/(protected)/portal/invoices/newinvoice/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

import {
  ArrowLeft,
  MoreVertical,
  Plus,
  Minus,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Car,
  FileText,
  Clock,
} from "lucide-react";

import VehicleImageDisplay from "@/components/VehicleImageDisplay";
import CarTopView from "@/components/tech/CarTopView";
import DamageTypeSelector from "@/components/tech/DamageTypeSelector";
import SignatureCanvas from "@/components/tech/SignatureCanvas";

/* ---------- Constants ---------- */

const SERVICE_CATEGORIES = [
  {
    id: "rni_rnr",
    label: "R&I / R&R",
    icon: "🔧",
    color: "from-blue-400 to-blue-500",
  },
  {
    id: "parts",
    label: "PARTS",
    icon: "⚙️",
    color: "from-purple-400 to-purple-500",
  },
  {
    id: "glass",
    label: "GLASS",
    icon: "✨",
    color: "from-green-400 to-green-500",
  },
  {
    id: "misc",
    label: "MISC",
    icon: "📋",
    color: "from-orange-400 to-orange-500",
  },
];

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "check", label: "Check" },
  { value: "offline_credit_card", label: "Offline Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const GLASS_LOCATIONS = [
  { id: "windshield", label: "WINDSHIELD" },
  { id: "lt_front_door", label: "LT FRONT DOOR" },
  { id: "rt_front_door", label: "RT FRONT DOOR" },
  { id: "sunroof", label: "SUNROOF" },
  { id: "lt_rear_door", label: "LT REAR DOOR" },
  { id: "rt_rear_door", label: "RT REAR DOOR" },
];

/* ---------- Types ---------- */

type AnyObj = Record<string, any>;

type Client = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes?: string | null;
  created_by_tech?: string | null;
};

type Vehicle = {
  id: string;
  client_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  vin: string | null;
  stock_ro?: string | null;
  license_plate?: string | null;
  vehicle_type?: string | null;
  trim?: string | null;
};

/* ---------- Page ---------- */

export default function AdminNewInvoicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [adminEmail, setAdminEmail] = React.useState<string | null>(null);
  const [technicianEmail, setTechnicianEmail] = React.useState<string>("");

  const [selectedClient, setSelectedClient] = React.useState<Client | null>(
    null
  );
  const [selectedVehicle, setSelectedVehicle] =
    React.useState<Vehicle | null>(null);

  const [activeGlassView, setActiveGlassView] = React.useState<
    "visual" | "list"
  >("visual");
  const [glassMode, setGlassMode] = React.useState<
    "flat" | "panel" | "repair"
  >("repair");
  const [activeRepairTab, setActiveRepairTab] = React.useState<
    "quadrant" | "type" | "resin" | "notes"
  >("quadrant");

  const [invoiceData, setInvoiceData] = React.useState({
    rni_rnr_total: 0,
    parts_total: 0,
    glass_total: 0,
    misc_total: 0,
    discount_percent: 20,
    tax_rate: 0,
    payment_method: "",
    payment_note: "",
  });

  const [glassRepairs, setGlassRepairs] = React.useState<
    Record<string, any[]>
  >({});
  const [currentGlassLocation, setCurrentGlassLocation] =
    React.useState<string>("windshield");
  const [currentRepair, setCurrentRepair] = React.useState({
    quadrant: "",
    damage_type: "",
    crack_length_inches: 0,
    notes: "",
    is_previous_repair: false,
    improve_severe: false,
  });

  const [signature, setSignature] = React.useState<string>("");
  const [showPayment, setShowPayment] = React.useState(false);
  const [paymentMode, setPaymentMode] = React.useState<
    "credit_card" | "offline"
  >("credit_card");

  /* ---------- Auth: admin only ---------- */

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session ?? null;
      if (!mounted) return;

      const user = session?.user;
      const role =
        (user?.app_metadata as AnyObj)?.role ||
        (user?.user_metadata as AnyObj)?.role;

      if (!user || !role || !["admin", "support"].includes(String(role))) {
        router.replace(
          `/admin/login?redirect=${encodeURIComponent(
            "/admin/portal/invoices/newinvoice"
          )}`
        );
        return;
      }

      const email = user.email ?? null;
      setAdminEmail(email);
      setTechnicianEmail(email ?? "");
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  /* ---------- Queries ---------- */

  // All clients (admin can see across techs)
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("clients")
        .select(
          "id, full_name, phone, email, address_line1, city, state, zip, notes, created_by_tech"
        )
        .order("full_name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Client[];
    },
    staleTime: 10_000,
  });

  // Vehicles for selected client
  const { data: clientVehicles = [] } = useQuery({
    queryKey: ["admin-client-vehicles", selectedClient?.id],
    enabled: !!selectedClient?.id,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("client_vehicles")
        .select(
          "id, client_id, year, make, model, color, vin, stock_ro, license_plate, vehicle_type, trim"
        )
        .eq("client_id", selectedClient!.id)
        .order("year", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Vehicle[];
    },
  });

  // Latest invoice number (from tech_invoices)
  const { data: latestInvoice, isLoading: loadingLatestInvoice } = useQuery({
    queryKey: ["admin-tech-invoices:latest"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .select("invoice_number")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as { invoice_number: string } | null;
    },
    staleTime: 10_000,
  });

  const getNextInvoiceNumber = React.useCallback(() => {
    if (!latestInvoice?.invoice_number) return "0001";
    const last = parseInt(latestInvoice.invoice_number, 10);
    if (Number.isNaN(last)) return "0001";
    return String(last + 1).padStart(4, "0");
  }, [latestInvoice]);

  /* ---------- Helpers ---------- */

  const getAllRepairs = () => Object.values(glassRepairs).flat();

  const calculateTotals = React.useCallback(() => {
    const subtotal =
      (invoiceData.rni_rnr_total || 0) +
      (invoiceData.parts_total || 0) +
      (invoiceData.glass_total || 0) +
      (invoiceData.misc_total || 0);

    const discountAmount =
      subtotal * ((invoiceData.discount_percent || 0) / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * ((invoiceData.tax_rate || 0) / 100);
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  }, [invoiceData]);

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId) || null;
    setSelectedClient(client);
    setSelectedVehicle(null);
  };

  const handleAddRepairToLocation = () => {
    if (!currentRepair.quadrant || !currentRepair.damage_type) {
      alert("Please select quadrant and damage type");
      return;
    }

    setGlassRepairs((prev) => ({
      ...prev,
      [currentGlassLocation]: [
        ...(prev[currentGlassLocation] || []),
        { ...currentRepair, location: currentGlassLocation },
      ],
    }));

    setCurrentRepair({
      quadrant: "",
      damage_type: "",
      crack_length_inches: 0,
      notes: "",
      is_previous_repair: false,
      improve_severe: false,
    });
  };

  const toCents = (n: number) => Math.round((n || 0) * 100);

  /* ---------- Persist Invoice (admin -> tech_invoices) ---------- */

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!adminEmail) throw new Error("Not signed in as admin");
      if (!selectedClient?.id) throw new Error("Client required");

      const effectiveTechEmail =
        technicianEmail?.trim() || adminEmail || null;

      if (!effectiveTechEmail) {
        throw new Error("Technician email is required");
      }

      const { total } = calculateTotals();
      const invoiceNumber = getNextInvoiceNumber();

      const payload = {
        invoice_number: invoiceNumber,
        technician_email: effectiveTechEmail,
        client_id: selectedClient.id,
        vehicle_id: selectedVehicle?.id ?? null,
        invoice_date: new Date().toISOString().split("T")[0],
        status: signature ? "paid" : "draft",

        services_json: {
          rni_rnr_total: invoiceData.rni_rnr_total,
          parts_total: invoiceData.parts_total,
          glass_total: invoiceData.glass_total,
          misc_total: invoiceData.misc_total,
        },

        windshield_repairs_json: getAllRepairs(),

        subtotal_cents: toCents(subtotal),
        discount_percent: invoiceData.discount_percent,
        discount_cents: toCents(discountAmount),
        tax_rate_percent: invoiceData.tax_rate,
        tax_cents: toCents(taxAmount),
        total_cents: toCents(total),

        payment_method: invoiceData.payment_method || null,
        payment_note: invoiceData.payment_note || null,

        customer_signature: signature || null,

        // Optional: flag as admin-created for future analytics
        created_by_admin_email: adminEmail,
      };

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId: string) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-tech-invoices:latest"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin:tech_invoices"],
      });
      router.push(`/admin/portal/invoices/invoice/${newId}`);
    },
  });

  const DISCLAIMER =
    "I have inspected my vehicle(s) and am satisfied that GLASS GUARDIAN CHIP AND CRACK REPAIR has completed repairs to my satisfaction. I understand if the repairs were ever to fail, GLASS GUARDIAN CHIP AND CRACK REPAIR provides a 2 year money back guarantee; This warranty applies only to repairs marked on invoice and completed by GLASS GUARDIAN CHIP AND CRACK REPAIR.";

  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex justify-between items-center"
        >
          <Button
            variant="outline"
            onClick={() =>
              router.push("/admin/portal/invoices")
            }
            className="bg-slate-900 text-slate-100 border-slate-700 shadow-xl hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>

          <div className="text-center">
            <motion.h1
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-2xl font-bold text-slate-50 mb-1"
            >
              New Tech Invoice #
              {loadingLatestInvoice ? "…" : getNextInvoiceNumber()}
            </motion.h1>
            <Badge className="bg-cyan-500/15 text-cyan-100 border-cyan-400/60">
              Glass Guardian · Admin
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-slate-200 hover:bg-slate-800"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Total Display */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.h2
            key={total}
            initial={{ scale: 1.3, filter: "brightness(1.5)" }}
            animate={{ scale: 1, filter: "brightness(1)" }}
            transition={{ type: "spring", stiffness: 200 }}
            className="text-6xl md:text-7xl font-bold text-slate-50 mb-3 drop-shadow-[0_12px_40px_rgba(15,23,42,0.9)]"
          >
            ${total.toFixed(2)}
          </motion.h2>
          <p className="text-slate-300 text-sm">
            {invoiceData.discount_percent}% Discount: -
            {discountAmount.toFixed(2)} · Tax {invoiceData.tax_rate}%: +
            {taxAmount.toFixed(2)}
          </p>
          {signature && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="mt-4"
            >
              <Badge className="bg-emerald-500 text-white px-6 py-2 text-lg shadow-xl shadow-emerald-500/50">
                ✓ Paid
              </Badge>
            </motion.div>
          )}
        </motion.div>

        {/* TECH EMAIL (admin override) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="border border-slate-800 bg-slate-900/80 shadow-2xl">
            <CardHeader className="border-b border-slate-800 bg-slate-900/90">
              <CardTitle className="text-slate-50 text-sm flex justify-between items-center">
                <span>Technician Assignment</span>
                <span className="text-[0.65rem] uppercase tracking-[0.24em] text-cyan-300/80">
                  Admin Override
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <Label className="text-xs text-slate-300">
                Technician Email (invoice will be attributed to this tech)
              </Label>
              <Input
                type="email"
                value={technicianEmail}
                onChange={(e) => setTechnicianEmail(e.target.value)}
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                placeholder="tech@example.com"
              />
              <p className="text-[11px] text-slate-400">
                Defaulted to your admin email. You can point this invoice to any
                technician email used in the field.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Client Picker (admin) */}
        {!selectedClient ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-none shadow-2xl bg-white">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                <CardTitle className="text-2xl">
                  Select Client (Global)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <Select onValueChange={handleClientSelect}>
                  <SelectTrigger className="text-lg h-14">
                    <SelectValue
                      placeholder={
                        loadingClients ? "Loading…" : "Choose a client..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem
                        key={client.id}
                        value={client.id}
                        className="text-lg py-3"
                      >
                        <div>
                          <p className="font-semibold">
                            {client.full_name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {client.email} · {client.phone}
                          </p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">
                      or
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-14 text-lg border-2 border-dashed border-blue-400 hover:bg-blue-50"
                  onClick={() =>
                    router.push("/admin/portal/clients/new")
                  }
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create New Client
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Client Info (admin) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="mb-6 bg-white border-none shadow-2xl">
                <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <motion.h3
                        initial={{ x: -20 }}
                        animate={{ x: 0 }}
                        className="text-3xl font-bold text-gray-900 mb-4"
                      >
                        {selectedClient.full_name}
                      </motion.h3>
                      <div className="space-y-2 text-base">
                        <p className="flex items-center gap-3 text-gray-700">
                          <Phone className="w-5 h-5 text-blue-600" />
                          {selectedClient.phone}
                        </p>
                        {selectedClient.email && (
                          <p className="flex items-center gap-3 text-gray-700">
                            <Mail className="w-5 h-5 text-blue-600" />
                            {selectedClient.email}
                          </p>
                        )}
                        {selectedClient.address_line1 && (
                          <p className="flex items-center gap-3 text-gray-700">
                            <MapPin className="w-5 h-5 text-blue-600" />
                            {selectedClient.address_line1},{" "}
                            {selectedClient.city}, {selectedClient.state}{" "}
                            {selectedClient.zip}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClient(null)}
                    >
                      Change Client
                    </Button>
                  </div>

                  {selectedClient.notes && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200 shadow-inner"
                    >
                      <p className="text-sm text-yellow-900 font-medium">
                        {selectedClient.notes}
                      </p>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-6 bg-white rounded-xl border-2 border-gray-200 shadow-lg text-center"
                  >
                    <p className="font-bold text-gray-900 mb-3">
                      Job is not scheduled
                    </p>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                      <Calendar className="w-4 h-4 mr-2" />
                      Link to Appointment
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Button
                variant="outline"
                className="bg-white border-none shadow-xl hover:shadow-2xl py-6 flex-col h-auto gap-2 hover:scale-105 transition-all"
                onClick={() => {
                  const el =
                    document.getElementById("vehicle-picker");
                  if (el)
                    el.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <span className="text-blue-600 font-bold text-xs">
                  ADD VEHICLE
                </span>
              </Button>

              <Button
                variant="outline"
                className="bg-white border-none shadow-xl hover:shadow-2xl py-6 flex-col h-auto gap-2 hover:scale-105 transition-all"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <span className="text-green-600 font-bold text-xs">
                  ADD WORK ORDER
                </span>
              </Button>

              <Button
                variant="outline"
                className="bg-white border-none shadow-xl hover:shadow-2xl py-6 flex-col h-auto gap-2 hover:scale-105 transition-all"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <span className="text-purple-600 font-bold text-xs">
                  PAYMENT HISTORY
                </span>
              </Button>
            </div>

            {/* Vehicle Picker */}
            {!selectedVehicle && clientVehicles.length > 0 && (
              <Card
                id="vehicle-picker"
                className="mb-6 bg-white border-none shadow-2xl"
              >
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                  <CardTitle>Select Vehicle</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-4">
                    {clientVehicles.map((vehicle, idx) => (
                      <motion.button
                        key={vehicle.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        onClick={() => setSelectedVehicle(vehicle)}
                        className="text-left p-6 bg-gradient-to-r from-white to-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-xl transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg"
                            style={{
                              background: `linear-gradient(135deg, ${
                                vehicle.color || "#6B7280"
                              }, ${vehicle.color || "#4B5563"})`,
                            }}
                          >
                            <Car className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {vehicle.year} {vehicle.make}{" "}
                              {vehicle.model}
                            </p>
                            <p className="text-sm text-gray-600">
                              VIN: {vehicle.vin || "N/A"}
                            </p>
                            {vehicle.stock_ro && (
                              <p className="text-sm text-gray-600">
                                Stock/RO: {vehicle.stock_ro}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Vehicle Display */}
            {selectedVehicle && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="mb-6 bg-white border-none shadow-2xl overflow-hidden">
                  <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl overflow-hidden">
                          <VehicleImageDisplay
                            make={selectedVehicle.make || ""}
                            model={selectedVehicle.model || ""}
                            year={selectedVehicle.year || undefined}
                            color={
                              selectedVehicle.color || "#E5E7EB"
                            }
                            className="h-64"
                          />
                        </div>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center mt-6"
                        >
                          <h3 className="text-3xl font-bold text-white mb-2">
                            {selectedVehicle.year}{" "}
                            {selectedVehicle.make?.toUpperCase()}
                          </h3>
                          <h4 className="text-xl text-blue-200 font-semibold mb-3">
                            {selectedVehicle.model?.toUpperCase()}
                            {selectedVehicle.color
                              ? `, ${selectedVehicle.color.toUpperCase()}`
                              : ""}
                          </h4>
                        </motion.div>
                      </div>

                      <div className="space-y-3">
                        {[
                          {
                            label: "VIN Number",
                            value: selectedVehicle.vin,
                          },
                          {
                            label: "Stock/RO #",
                            value: selectedVehicle.stock_ro,
                          },
                          {
                            label: "Year",
                            value: selectedVehicle.year,
                          },
                          {
                            label: "Make",
                            value: selectedVehicle.make,
                          },
                          {
                            label: "Model",
                            value: selectedVehicle.model,
                          },
                          {
                            label: "Exterior Color",
                            value: selectedVehicle.color,
                          },
                          {
                            label: "Vehicle Type",
                            value: selectedVehicle.vehicle_type,
                          },
                          {
                            label: "Trim",
                            value: selectedVehicle.trim,
                          },
                        ]
                          .filter((item) => item.value)
                          .map((item, idx) => (
                            <motion.div
                              key={`${item.label}-${idx}`}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="flex justify-between items-center p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20"
                            >
                              <span className="text-gray-300 font-medium">
                                {item.label}
                              </span>
                              <span className="font-bold text-white text-right">
                                {String(item.value)}
                              </span>
                            </motion.div>
                          ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* SERVICES */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card className="mb-6 bg-white border-none shadow-2xl">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                  <CardTitle className="text-2xl">
                    SERVICES
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {SERVICE_CATEGORIES.map((category, idx) => (
                      <motion.div
                        key={category.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        className="text-center"
                      >
                        <div
                          className={`w-24 h-24 mx-auto mb-4 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center text-4xl shadow-xl hover:shadow-2xl transition-all`}
                        >
                          {category.icon}
                        </div>
                        <p className="font-bold text-sm mb-3 text-gray-900">
                          {category.label}
                        </p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={
                              (invoiceData as AnyObj)[
                                `${category.id}_total`
                              ] || 0
                            }
                            onChange={(e) =>
                              setInvoiceData((cur) => ({
                                ...cur,
                                [`${category.id}_total`]:
                                  parseFloat(e.target.value) || 0,
                              }))
                            }
                            placeholder="0.00"
                            className="text-center text-lg font-semibold pl-7 h-12 border-2"
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="mt-8 p-6 bg-gradient-to-r from-green-50 via-green-100 to-green-50 rounded-2xl border-2 border-green-300 shadow-xl"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold text-gray-900">
                        Grand Total
                      </span>
                      <motion.span
                        key={subtotal}
                        initial={{
                          scale: 1.2,
                          color: "#10b981",
                        }}
                        animate={{ scale: 1, color: "#059669" }}
                        className="text-4xl font-bold"
                      >
                        ${subtotal.toFixed(2)}
                      </motion.span>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>

            {/* GLASS WORK ORDER */}
            <Card className="mb-6 bg-gradient-to-br from-slate-800 to-slate-900 border-none shadow-2xl text-white">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">
                    GLASS
                  </CardTitle>
                  <Tabs
                    value={activeGlassView}
                    onValueChange={(v) =>
                      setActiveGlassView(v as any)
                    }
                  >
                    <TabsList className="bg-white/10 border border-white/20">
                      <TabsTrigger
                        value="visual"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
                      >
                        VISUAL
                      </TabsTrigger>
                      <TabsTrigger
                        value="list"
                        className="data-[state=active]:bg-white data-[state=active]:text-gray-900"
                      >
                        LIST
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>

              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <motion.div
                    className="inline-block p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl"
                    whileHover={{ scale: 1.05 }}
                  >
                    <p className="text-5xl font-bold">
                      $
                      {Number(
                        invoiceData.glass_total || 0
                      ).toFixed(2)}
                    </p>
                  </motion.div>
                </div>

                {/* Mode */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex rounded-full bg-white/10 backdrop-blur-md p-1.5 border border-white/20 shadow-xl">
                    {(["flat", "panel", "repair"] as const).map(
                      (mode) => (
                        <motion.button
                          key={mode}
                          onClick={() => setGlassMode(mode)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`px-8 py-3 rounded-full text-sm font-bold transition-all ${
                            glassMode === mode
                              ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                              : "text-white/70 hover:text-white"
                          }`}
                        >
                          {mode.charAt(0).toUpperCase() +
                            mode.slice(1)}
                        </motion.button>
                      )
                    )}
                  </div>
                </div>

                {/* Visual Repair */}
                {activeGlassView === "visual" &&
                  glassMode === "repair" && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="visual-repair"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Card className="bg-white text-gray-900 border-none shadow-2xl">
                          <CardContent className="p-6">
                            <Tabs
                              value={activeRepairTab}
                              onValueChange={(v) =>
                                setActiveRepairTab(v as any)
                              }
                            >
                              <TabsList className="grid w-full grid-cols-4 mb-8 h-14 bg-gray-100">
                                {(
                                  [
                                    "quadrant",
                                    "type",
                                    "resin",
                                    "notes",
                                  ] as const
                                ).map((tab) => (
                                  <TabsTrigger
                                    key={tab}
                                    value={tab}
                                    className="text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg"
                                  >
                                    {tab.toUpperCase()}
                                  </TabsTrigger>
                                ))}
                              </TabsList>

                              <TabsContent
                                value="quadrant"
                                className="mt-8"
                              >
                                <CarTopView
                                  color={
                                    selectedVehicle?.color ||
                                    "#E5E7EB"
                                  }
                                  selectedQuadrant={
                                    currentRepair.quadrant
                                  }
                                  onSelectQuadrantAction={(
                                    quadrant: string
                                  ) =>
                                    setCurrentRepair((cr) => ({
                                      ...cr,
                                      quadrant,
                                    }))
                                  }
                                />
                              </TabsContent>

                              <TabsContent
                                value="type"
                                className="mt-8"
                              >
                                <DamageTypeSelector
                                  selectedType={
                                    currentRepair.damage_type
                                  }
                                  onSelectTypeAction={(
                                    type: string
                                  ) =>
                                    setCurrentRepair((cr) => ({
                                      ...cr,
                                      damage_type: type,
                                    }))
                                  }
                                />
                              </TabsContent>

                              <TabsContent
                                value="resin"
                                className="mt-8"
                              >
                                <div className="text-center py-12">
                                  <p className="text-gray-500 mb-4">
                                    Resin Selection
                                  </p>
                                  <div className="max-w-md mx-auto p-8 border-2 border-dashed border-gray-300 rounded-2xl">
                                    <p className="text-gray-400">
                                      Resin catalog coming
                                      soon
                                    </p>
                                  </div>
                                </div>
                              </TabsContent>

                              <TabsContent
                                value="notes"
                                className="mt-8"
                              >
                                <div className="max-w-2xl mx-auto space-y-4">
                                  <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-all"
                                  >
                                    <span className="font-bold text-gray-900">
                                      FIX POOR PREVIOUS REPAIR
                                    </span>
                                    <Switch
                                      checked={
                                        currentRepair.is_previous_repair
                                      }
                                      onCheckedChange={(checked) =>
                                        setCurrentRepair(
                                          (cr) => ({
                                            ...cr,
                                            is_previous_repair:
                                              checked,
                                          })
                                        )
                                      }
                                      className="data-[state=checked]:bg-blue-600"
                                    />
                                  </motion.div>

                                  <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-all"
                                  >
                                    <span className="font-bold text-gray-900">
                                      IMPROVE SEVERE CRACK
                                    </span>
                                    <Switch
                                      checked={
                                        currentRepair.improve_severe
                                      }
                                      onCheckedChange={(checked) =>
                                        setCurrentRepair(
                                          (cr) => ({
                                            ...cr,
                                            improve_severe:
                                              checked,
                                          })
                                        )
                                      }
                                      className="data-[state=checked]:bg-blue-600"
                                    />
                                  </motion.div>

                                  <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 shadow-inner">
                                    <div className="flex items-center justify-between mb-4">
                                      <span className="font-bold text-gray-900 text-lg">
                                        INCH CRACK
                                      </span>
                                      <div className="flex items-center gap-4">
                                        <motion.button
                                          whileHover={{
                                            scale: 1.1,
                                          }}
                                          whileTap={{
                                            scale: 0.9,
                                          }}
                                        >
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-12 w-12 rounded-full bg-white shadow-lg"
                                            onClick={() =>
                                              setCurrentRepair(
                                                (cr) => ({
                                                  ...cr,
                                                  crack_length_inches:
                                                    Math.max(
                                                      0,
                                                      cr.crack_length_inches -
                                                        1
                                                    ),
                                                })
                                              )
                                            }
                                          >
                                            <Minus className="w-5 h-5" />
                                          </Button>
                                        </motion.button>
                                        <motion.span
                                          key={
                                            currentRepair.crack_length_inches
                                          }
                                          initial={{
                                            scale: 1.3,
                                          }}
                                          animate={{
                                            scale: 1,
                                          }}
                                          className="text-3xl font-bold w-16 text-center text-gray-900"
                                        >
                                          {
                                            currentRepair.crack_length_inches
                                          }
                                        </motion.span>
                                        <motion.button
                                          whileHover={{
                                            scale: 1.1,
                                          }}
                                          whileTap={{
                                            scale: 0.9,
                                          }}
                                        >
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-12 w-12 rounded-full bg-white shadow-lg"
                                            onClick={() =>
                                              setCurrentRepair(
                                                (cr) => ({
                                                  ...cr,
                                                  crack_length_inches:
                                                    cr.crack_length_inches +
                                                    1,
                                                })
                                              )
                                            }
                                          >
                                            <Plus className="w-5 h-5" />
                                          </Button>
                                        </motion.button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-6 bg-gray-50 rounded-xl border-2 border-gray-200 shadow-inner">
                                    <Label className="font-bold mb-3 block text-gray-900 text-lg">
                                      CUSTOM NOTE
                                    </Label>
                                    <Textarea
                                      value={currentRepair.notes}
                                      onChange={(e) =>
                                        setCurrentRepair(
                                          (cr) => ({
                                            ...cr,
                                            notes: e.target.value,
                                          })
                                        )
                                      }
                                      placeholder="Enter Note..."
                                      rows={5}
                                      className="bg-white border-2 text-base"
                                    />
                                  </div>

                                  <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    <Button
                                      onClick={
                                        handleAddRepairToLocation
                                      }
                                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 text-lg font-bold shadow-xl"
                                      disabled={
                                        !currentRepair.quadrant ||
                                        !currentRepair.damage_type
                                      }
                                    >
                                      <Plus className="w-5 h-5 mr-2" />
                                      Add Repair to{" "}
                                      {currentGlassLocation
                                        .toUpperCase()
                                        .replace(/_/g, " ")}
                                    </Button>
                                  </motion.div>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </AnimatePresence>
                  )}

                {/* List View */}
                {activeGlassView === "list" && (
                  <div className="space-y-4">
                    {GLASS_LOCATIONS.map((location) => (
                      <motion.div
                        key={location.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-lg">
                            {location.label}
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            onClick={() => {
                              setCurrentGlassLocation(location.id);
                              setActiveGlassView("visual");
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Repair
                          </Button>
                        </div>

                        {glassRepairs[location.id] &&
                        glassRepairs[location.id].length > 0 ? (
                          <div className="space-y-2">
                            {glassRepairs[location.id].map(
                              (repair, idx) => (
                                <div
                                  key={`${location.id}-${idx}`}
                                  className="p-4 bg-white/10 rounded-lg border border-white/10 text-sm"
                                >
                                  <p className="font-semibold">
                                    {repair.quadrant
                                      ?.toUpperCase()}{" "}
                                    -{" "}
                                    {repair.damage_type
                                      ?.toUpperCase()}
                                  </p>
                                  {repair.crack_length_inches >
                                    0 && (
                                    <p className="text-slate-200">
                                      {
                                        repair.crack_length_inches
                                      }
                                      " crack
                                    </p>
                                  )}
                                  {repair.notes && (
                                    <p className="text-slate-200 mt-1">
                                      Note: {repair.notes}
                                    </p>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-sm">
                            No repairs added
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PAYMENT CTA */}
            {!showPayment && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={() => setShowPayment(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 py-8 text-xl font-bold shadow-2xl shadow-blue-500/30"
                  disabled={total === 0}
                >
                  Proceed to Payment
                </Button>
              </motion.div>
            )}

            {showPayment && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Payment Method */}
                <Card className="mb-6 bg-white border-none shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <CardTitle className="text-2xl">
                      PAYMENT METHOD
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <motion.div
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className="text-center mb-6"
                    >
                      <p className="text-6xl font-bold text-gray-900 mb-2">
                        ${total.toFixed(2)}
                      </p>
                      <p className="text-gray-500">Balance Due</p>
                      <p className="text-sm text-gray-600 mt-2">
                        Invoice #
                        {loadingLatestInvoice
                          ? "…"
                          : getNextInvoiceNumber()}{" "}
                        - {new Date().toLocaleDateString()}
                      </p>
                      <div className="mt-4 inline-block px-6 py-2 bg-gray-100 rounded-full">
                        <span className="text-sm font-medium text-gray-600">
                          Total Paid: $0.00
                        </span>
                      </div>
                    </motion.div>

                    {/* Toggle */}
                    <div className="grid grid-cols-2 gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          setPaymentMode("credit_card")
                        }
                        className={`p-6 rounded-xl border-3 transition-all ${
                          paymentMode === "credit_card"
                            ? "border-blue-500 bg-blue-50 shadow-xl"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full mx-auto mb-3 ${
                            paymentMode === "credit_card"
                              ? "bg-blue-500"
                              : "bg-gray-300"
                          }`}
                        />
                        <p className="font-bold text-gray-900">
                          Credit Card
                        </p>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPaymentMode("offline")}
                        className={`p-6 rounded-xl border-3 transition-all ${
                          paymentMode === "offline"
                            ? "border-blue-500 bg-blue-50 shadow-xl"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full mx-auto mb-3 ${
                            paymentMode === "offline"
                              ? "bg-blue-500"
                              : "bg-gray-300"
                          }`}
                        />
                        <p className="font-bold text-gray-900">
                          Offline Payment
                        </p>
                      </motion.button>
                    </div>

                    {/* Amount Breakdown */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 border-3 border-blue-500 bg-blue-50 rounded-xl text-center shadow-lg">
                        <p className="text-sm text-gray-600 mb-2">
                          Amount to pay
                        </p>
                        <p className="text-3xl font-bold text-gray-900">
                          ${total.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-6 border-2 border-gray-300 rounded-xl text-center">
                        <p className="text-sm text-gray-600 mb-2">
                          Remaining Balance
                        </p>
                        <p className="text-3xl font-bold text-gray-900">
                          Total: $0.00
                        </p>
                      </div>
                    </div>

                    {/* Offline Payment Options */}
                    {paymentMode === "offline" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-4"
                      >
                        <Label className="text-lg font-bold">
                          Payment method
                        </Label>
                        <Select
                          value={invoiceData.payment_method}
                          onValueChange={(value) =>
                            setInvoiceData((cur) => ({
                              ...cur,
                              payment_method: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-14 text-lg border-2">
                            <SelectValue placeholder="Select a method" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((method) => (
                              <SelectItem
                                key={method.value}
                                value={method.value}
                                className="text-lg py-3"
                              >
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div>
                          <Label className="text-lg font-bold mb-3 block">
                            Enter payment note
                          </Label>
                          <Textarea
                            value={invoiceData.payment_note}
                            onChange={(e) =>
                              setInvoiceData((cur) => ({
                                ...cur,
                                payment_note: e.target.value,
                              }))
                            }
                            placeholder="Enter payment note"
                            rows={4}
                            className="text-base border-2"
                          />
                        </div>
                      </motion.div>
                    )}

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        onClick={() => setShowPayment(false)}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 py-7 text-xl font-bold shadow-2xl shadow-blue-500/30"
                        disabled={
                          paymentMode === "offline" &&
                          !invoiceData.payment_method
                        }
                      >
                        MARK AS PAID / CONTINUE
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>

                {/* SIGNATURE */}
                <Card className="mb-6 bg-white border-none shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <CardTitle className="text-2xl">
                      SIGNATURE
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center mb-8"
                    >
                      <p className="text-5xl font-bold text-gray-900 mb-2">
                        ${total.toFixed(2)}
                      </p>
                      <p className="text-gray-500">
                        Invoice Total
                      </p>
                    </motion.div>

                    <SignatureCanvas
                      onSaveAction={(signatureData: string) =>
                        setSignature(signatureData)
                      }
                      disclaimer={DISCLAIMER}
                    />

                    {signature && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8"
                      >
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            onClick={() =>
                              createInvoiceMutation.mutate()
                            }
                            disabled={
                              createInvoiceMutation.isPending
                            }
                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 py-8 text-xl font-bold shadow-2xl shadow-emerald-500/30"
                          >
                            {createInvoiceMutation.isPending ? (
                              <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                                Saving Invoice...
                              </div>
                            ) : (
                              "COMPLETE & SAVE INVOICE"
                            )}
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}