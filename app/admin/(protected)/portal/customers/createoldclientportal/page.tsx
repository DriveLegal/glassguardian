"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Mail,
  UserPlus,
  Car,
  Shield,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MapPin,
  Calendar as CalendarIcon,
  DollarSign,
  Send,
  ArrowRight,
} from "lucide-react";

import { supabaseClient } from "@/lib/supabaseClient";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------
   Types & Helpers
------------------------------------------------------------------- */

type ContactFormState = {
  full_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
};

type VehicleFormState = {
  make: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  license_plate: string;
  insurance_carrier: string;
  body_type: string;
};

type RepairFormState = {
  service_date: string;
  service_performed: string;
  coverage_type: string;
  expiration_date: string;
  invoice_total: string;
  amount_paid: string;
  payment_method: string;
  warranty_number: string;
  repair_spot: string | null;
  internal_notes: string;
  customer_facing_notes: string;
};

type CreatePayload = {
  contact: ContactFormState;
  vehicle: VehicleFormState;
  repair: RepairFormState;
};

type CreatedEntities = {
  appUser: any;
  vehicle: any;
  invoice: any;
  warranty: any;
};

const EMPTY_CONTACT: ContactFormState = {
  full_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

const EMPTY_VEHICLE: VehicleFormState = {
  make: "",
  model: "",
  year: "",
  color: "",
  vin: "",
  license_plate: "",
  insurance_carrier: "",
  body_type: "",
};

const EMPTY_REPAIR: RepairFormState = {
  service_date: "",
  service_performed: "",
  coverage_type: "",
  expiration_date: "",
  invoice_total: "",
  amount_paid: "",
  payment_method: "",
  warranty_number: "",
  repair_spot: null,
  internal_notes: "",
  customer_facing_notes: "",
};

function generateWarrantyNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `GG-${year}-${rand}`;
}

/** Simple invoice number helper: INV-YYYY-<timestamp>-<rand> */
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const timestamp = now.toISOString().replace(/\D/g, "").slice(0, 14); // YYYYMMDDHHMMSS
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `INV-${year}-${timestamp}-${rand}`;
}

/* ---------------- Sentence / text cleanup helpers ---------------- */

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Light auto grammar / punctuation polish:
 * - Trim + collapse spaces
 * - Capitalize first character
 * - Add period at end if missing basic punctuation
 */
function cleanSentence(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";

  let result = trimmed;
  result = result[0].toUpperCase() + result.slice(1);

  if (!/[.!?]$/.test(result)) {
    result = result + ".";
  }

  return result;
}

function labelSpot(key: string): string {
  return key
    .split("_")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

/* Money helper (string dollars -> integer cents or null) */
function dollarsToCents(value: string): number | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

function parseVehicleYear(yearStr: string): number {
  const y = Number(String(yearStr || "").trim());
  if (Number.isNaN(y) || !Number.isInteger(y) || y < 1900 || y > 2100) {
    throw new Error("Vehicle year must be a valid 4-digit year.");
  }
  return y;
}

/* ------------------------------------------------------------------
   Simple 3x3 windshield spot picker (writes to warranties.spot_location)
------------------------------------------------------------------- */

const SPOTS = [
  "top_left",
  "top_center",
  "top_right",
  "mid_left",
  "mid_center",
  "mid_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;

function WindshieldSpotPicker(props: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  const { value, onChange } = props;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-slate-300">
          Windshield repair location
        </Label>
        {value && (
          <span className="text-[10px] uppercase tracking-wide text-emerald-400">
            Selected: {labelSpot(value)}
          </span>
        )}
      </div>
      <div className="aspect-[3/2] w-full max-w-xs rounded-xl border border-slate-700 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-1 shadow-inner">
        <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-1">
          {SPOTS.map((spot) => {
            const active = value === spot;
            return (
              <button
                key={spot}
                type="button"
                onClick={() => onChange(spot)}
                className={[
                  "flex items-center justify-center rounded-sm text-[10px] font-medium uppercase tracking-tight transition-all",
                  "border border-slate-700/60 bg-slate-900/60 hover:border-emerald-500/70 hover:bg-slate-900",
                  active
                    ? "border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(45,212,191,0.6)]"
                    : "",
                ].join(" ")}
              >
                {spot
                  .split("_")
                  .map((s) => s[0].toUpperCase())
                  .join("")}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Tap the approximate area where you performed the repair. We store this
        as <code>spot_location</code> on the warranty so the portal can display
        it later.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------
   Supabase mutation: create / connect app_user, client, vehicle, invoice, warranty
------------------------------------------------------------------- */

function formatSbError(err: any) {
  if (!err) return "Unknown Supabase error.";
  const parts = [
    err.message ? `message: ${err.message}` : null,
    err.code ? `code: ${err.code}` : null,
    err.details ? `details: ${err.details}` : null,
    err.hint ? `hint: ${err.hint}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

async function createOldClientPortalRecords(
  payload: CreatePayload
): Promise<CreatedEntities> {
  const { contact, vehicle, repair } = payload;

  const email = contact.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");
  if (!contact.full_name.trim()) throw new Error("Full name is required.");

  if (!vehicle.make.trim() || !vehicle.model.trim() || !vehicle.year.trim()) {
    throw new Error("Vehicle make, model, and year are required.");
  }

  if (!repair.service_date || !repair.coverage_type || !repair.expiration_date) {
    throw new Error(
      "Service date, coverage type, and warranty expiration date are required."
    );
  }

  const yearAsNumber = parseVehicleYear(vehicle.year);

  // 🔹 Current auth user (admin must be logged in)
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError) {
    console.error("Error getting auth user:", authError);
    throw new Error(`Unable to read current session: ${authError.message}`);
  }

  const actorEmail = user?.email ?? null;
  const actorId = user?.id ?? null;

  if (!actorEmail || !actorId) {
    throw new Error(
      "No authenticated account found. Make sure you are logged in."
    );
  }

  /* -----------------------------
     1) Upsert portal user (app_users)
  ------------------------------ */

  const { data: appUser, error: appUserUpsertError } = await supabaseClient
    .from("app_users")
    .upsert(
  {
    email,
    full_name: contact.full_name.trim(),
    phone: contact.phone || null,
    address_line1: contact.address_line1 || null,
    address_line2: contact.address_line2 || null,
    city: contact.city || null,
    state: contact.state || null,
    zip: contact.zip || null,
    notes: contact.notes || null,
    tech_email: actorEmail,
    created_by_tech: actorEmail,
  },
  { onConflict: "email" }
)
    .select("*")
    .single();

  if (appUserUpsertError || !appUser) {
    console.error("app_users upsert error:", appUserUpsertError);
    throw new Error(
      `Unable to create/update client record in app_users: ${formatSbError(
        appUserUpsertError
      )}`
    );
  }

  /* -----------------------------
     1b) Find or create CRM client in `clients`
  ------------------------------ */

  const { data: existingClient, error: fetchClientError } = await supabaseClient
    .from("clients")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (fetchClientError) {
    console.error("clients lookup error:", fetchClientError);
    throw new Error(
      `Unable to look up existing client record in clients: ${formatSbError(
        fetchClientError
      )}`
    );
  }

  let client = existingClient;

  if (!client) {
    const { data: newClient, error: clientInsertError } = await supabaseClient
      .from("clients")
      .insert({
        email,
        full_name: contact.full_name,
      })
      .select("*")
      .single();

    if (clientInsertError || !newClient) {
      console.error("clients insert error:", clientInsertError);
      throw new Error(
        `Unable to create client record in clients: ${formatSbError(
          clientInsertError
        )}`
      );
    }

    client = newClient;
  }

  /* -----------------------------
     2) Create vehicle
  ------------------------------ */

  const { data: vehicleRow, error: vehicleError } = await supabaseClient
    .from("vehicles")
    .insert({
      owner_email: email,
      make: vehicle.make || null,
      model: vehicle.model || null,
      year: yearAsNumber,
      color: vehicle.color || null,
      vin: vehicle.vin || null,
      license_plate: vehicle.license_plate || null,
      insurance_carrier: vehicle.insurance_carrier || null,
      body_type: vehicle.body_type || null,
    })
    .select("*")
    .single();

  if (vehicleError || !vehicleRow) {
    console.error("vehicles insert error:", vehicleError);
    throw new Error(`Unable to create vehicle record: ${formatSbError(vehicleError)}`);
  }

  /* -----------------------------
     3) Create invoice (tech_invoices)
  ------------------------------ */

  const subtotalCents = dollarsToCents(repair.invoice_total);
  const discountPercent = 0;
  const discountCents = 0;
  const taxRatePercent = 0;
  const taxCents = 0;

  const totalCents =
    subtotalCents === null ? null : subtotalCents - discountCents + taxCents;

  const servicesJson =
    subtotalCents !== null
      ? [
          {
            description:
              repair.service_performed || "Windshield repair (details not set)",
            amount_cents: subtotalCents,
          },
        ]
      : [
          {
            description:
              repair.service_performed || "Windshield repair (details not set)",
            amount_cents: null,
          },
        ];

  const serviceAddress = normalizeWhitespace(
    [
      contact.address_line1,
      contact.address_line2,
      [contact.city, contact.state, contact.zip].filter(Boolean).join(" "),
    ]
      .filter((part) => !!part && part.trim().length > 0)
      .join(", ")
  );

  const { data: invoiceRow, error: invoiceError } = await supabaseClient
    .from("tech_invoices")
    .insert({
      invoice_number: generateInvoiceNumber(),
      technician_email: actorEmail,
      client_id: client.id,
      vehicle_id: vehicleRow.id,
      invoice_date: repair.service_date, // ✅ ties invoice date to the input service_date
      status: "paid",
      services_json: servicesJson,
      windshield_repairs_json: null,
      subtotal_cents: subtotalCents,
      discount_percent: discountPercent,
      discount_cents: discountCents,
      tax_rate_percent: taxRatePercent,
      tax_cents: taxCents,
      total_cents: totalCents,
      payment_method: repair.payment_method || "previous_method",
      payment_note: repair.internal_notes || null,
      customer_signature: null,
      appointment_id: null,
      customer_email: email,
      service_address: serviceAddress || null,
      appointment_snapshot: null,
      customer_name: contact.full_name || null,
    })
    .select("*")
    .single();

  if (invoiceError || !invoiceRow) {
    console.error("tech_invoices insert error:", invoiceError);
    throw new Error(`Unable to create invoice record: ${formatSbError(invoiceError)}`);
  }

  /* -----------------------------
     4) Create warranty
  ------------------------------ */

  const finalWarrantyNumber =
    repair.warranty_number.trim() || generateWarrantyNumber();

  const expirationDate = repair.expiration_date || null;
  const expiresAt =
    expirationDate != null
      ? new Date(expirationDate + "T23:59:59.000Z").toISOString()
      : null;

  const { data: warrantyRow, error: warrantyError } = await supabaseClient
    .from("warranties")
    .insert({
      warranty_number: finalWarrantyNumber,
      is_active: true,
      expires_at: expiresAt,
      client_id: appUser.id,
      claimed_by_user: null,
      claimed_at: null,
      issued_by_tech: actorId,
      invoice_id: invoiceRow.id,
      notes: repair.customer_facing_notes || null,
      customer_email: email,
      status: "active",
      expiration_date: expirationDate,
      service_performed: repair.service_performed || "Windshield repair",
      service_date: repair.service_date || null, // ✅ already correct
      coverage_type: repair.coverage_type || null,
      qr_code_url: null,
      spot_location: repair.repair_spot || null,
      vehicle_year: yearAsNumber,
      vehicle_make: vehicle.make || null,
      vehicle_model: vehicle.model || null,
      vehicle_plate: vehicle.license_plate || null,
    })
    .select("*")
    .single();

  if (warrantyError || !warrantyRow) {
    console.error("warranties insert error:", warrantyError);
    throw new Error(`Unable to create warranty record: ${formatSbError(warrantyError)}`);
  }

  return {
    appUser,
    vehicle: vehicleRow,
    invoice: invoiceRow,
    warranty: warrantyRow,
  };
}

/* ------------------------------------------------------------------
   Main page component
------------------------------------------------------------------- */

export default function CreateOldClientPortalPage() {
  const router = useRouter();

  const [contact, setContact] = useState<ContactFormState>(EMPTY_CONTACT);
  const [vehicle, setVehicle] = useState<VehicleFormState>(EMPTY_VEHICLE);
  const [repair, setRepair] = useState<RepairFormState>(EMPTY_REPAIR);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [emailSending, setEmailSending] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState<string | null>(null);

  const [inviteRedirecting, setInviteRedirecting] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: CreatePayload) => createOldClientPortalRecords(payload),
    onSuccess: (data) => {
      setErrorMessage(null);
      setSuccessMessage(
        "Old client portal created. Records for user, vehicle, invoice, and warranty have been saved."
      );

      if (!repair.warranty_number.trim() && data.warranty?.warranty_number) {
        setRepair((prev) => ({
          ...prev,
          warranty_number: data.warranty.warranty_number,
        }));
      }
    },
    onError: (err: unknown) => {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : "Something went wrong creating the old client portal.";
      setErrorMessage(msg);
      setSuccessMessage(null);
    },
  });

  const handleContactChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setContact((prev) => ({ ...prev, [name]: value }));
  };

  const handleVehicleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVehicle((prev) => ({ ...prev, [name]: value }));
  };

  const handleRepairChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // 🔹 Auto-calc warranty expiration to 2 years from service date
    if (name === "service_date") {
      let expiration = repair.expiration_date;
      if (value) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          d.setFullYear(d.getFullYear() + 2);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          expiration = `${y}-${m}-${day}`;
        }
      } else {
        expiration = "";
      }

      setRepair((prev) => ({
        ...prev,
        service_date: value,
        expiration_date: expiration,
      }));
      return;
    }

    setRepair((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailSentMessage(null);

    const cleanedRepair: RepairFormState = {
      ...repair,
      service_performed: cleanSentence(repair.service_performed || ""),
      // NOTE: if you want coverage_type as a phrase (not a sentence), remove cleanSentence here.
      coverage_type: cleanSentence(repair.coverage_type || ""),
      internal_notes: repair.internal_notes
        ? cleanSentence(repair.internal_notes)
        : "",
      customer_facing_notes: repair.customer_facing_notes
        ? cleanSentence(repair.customer_facing_notes)
        : "",
      payment_method: repair.payment_method
        ? cleanSentence(repair.payment_method)
        : "",
    };

    setRepair(cleanedRepair);

    mutation.mutate({
      contact,
      vehicle,
      repair: cleanedRepair,
    });
  };

  const handleSendEmail = async () => {
    setEmailSentMessage(null);

    const effectiveEmail = contact.email.trim().toLowerCase();

    if (!effectiveEmail) {
      setEmailSentMessage("Please enter a valid email before sending.");
      return;
    }

    // ✅ REQUIRE SERVICE DATE (so email never defaults to "On file")
    if (!repair.service_date) {
      setEmailSentMessage("Please set the Service date before sending the invite.");
      return;
    }

    if (!repair.expiration_date || !repair.service_performed) {
      setEmailSentMessage(
        "Please set service and expiration details before sending the invite."
      );
      return;
    }

    try {
      setEmailSending(true);

      const warrantyNumToSend =
        repair.warranty_number?.trim() || generateWarrantyNumber();

      const res = await fetch("/api/email/old-client-portal-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: effectiveEmail,
          fullName: contact.full_name,
          warrantyNumber: warrantyNumToSend,
          warrantyExpiration: repair.expiration_date,

          // ✅ THIS IS THE FIX: send the service_date input as a dedicated date field
          dateServicedPerformed: repair.service_date,

          // keep servicePerformed as the actual description
          servicePerformed: repair.service_performed || "Windshield repair",
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Email API returned non-OK. ${t ? `Body: ${t}` : ""}`);
      }

      if (!repair.warranty_number?.trim()) {
        setRepair((prev) => ({ ...prev, warranty_number: warrantyNumToSend }));
      }

      setEmailSentMessage(
        "Invite sent. Client now has a clear pathway into their upgraded Glass Guardian portal."
      );

      setInviteRedirecting(true);
      window.setTimeout(() => {
        router.push(
          `/admin/portal/customers?old_invite=1&email=${encodeURIComponent(
            effectiveEmail
          )}&warranty=${encodeURIComponent(warrantyNumToSend)}`
        );
      }, 650);
    } catch (error) {
      console.error(error);
      setEmailSentMessage(
        "We couldn’t send the email invite. Double-check the API route and try again."
      );
    } finally {
      setEmailSending(false);
    }
  };

  const isPrimaryActionDisabled = useMemo(() => {
    if (mutation.isPending) return true;
    if (!contact.full_name.trim()) return true;
    if (!contact.email.trim()) return true;
    if (!vehicle.make.trim() || !vehicle.model.trim() || !vehicle.year.trim())
      return true;
    if (!repair.service_date || !repair.coverage_type || !repair.expiration_date)
      return true;
    return false;
  }, [mutation.isPending, contact, vehicle, repair]);

  return (
    <div className="min-h-screen bg-slate-950/95 px-4 py-6 md:px-8 md:py-10">
      {/* BG FX */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-40 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.6),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9),_black_70%)]" />
      </div>

      <motion.header
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mb-6 flex flex-col gap-2"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-200/90">
          <Shield className="h-3 w-3" />
          Old client portal onboard
        </div>
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
          Give a past customer a{" "}
          <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
            modern Glass Guardian portal
          </span>
        </h1>
        <p className="max-w-2xl text-sm text-slate-300/80">
          Capture their contact details, vehicle, repair, invoice and warranty in
          one sweep. We’ll wire everything so they can log in, see their
          coverage, and rebook in a couple of taps.
        </p>
      </motion.header>

      <div className="grid gap-5 md:grid-cols-[minmax(0,_3fr)_minmax(0,_2.5fr)]">
        {/* Left: Form */}
        <motion.section
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Contact card */}
          <Card className="border-slate-800/80 bg-slate-900/80 shadow-[0_18px_55px_rgba(15,23,42,0.85)] backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                  <UserPlus className="h-4 w-4 text-emerald-400" />
                  1. Client contact
                </CardTitle>
                <p className="text-xs text-slate-400">
                  We already fixed their glass — now we’re giving them a digital
                  command center.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/5 text-[10px] uppercase tracking-[0.18em] text-emerald-200"
              >
                Existing customer
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    placeholder="Jane Doe"
                    value={contact.full_name}
                    onChange={handleContactChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="(555) 555-0123"
                    value={contact.phone}
                    onChange={handleContactChange}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email (portal login)</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="jane@example.com"
                    value={contact.email}
                    onChange={handleContactChange}
                  />
                  <div className="flex items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 px-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                <div className="space-y-1">
                  <Label htmlFor="address_line1">Street address</Label>
                  <Input
                    id="address_line1"
                    name="address_line1"
                    placeholder="123 Example Ave"
                    value={contact.address_line1}
                    onChange={handleContactChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address_line2">Apt / Suite (optional)</Label>
                  <Input
                    id="address_line2"
                    name="address_line2"
                    placeholder="#203"
                    value={contact.address_line2}
                    onChange={handleContactChange}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="Rancho Cucamonga"
                    value={contact.city}
                    onChange={handleContactChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="CA"
                    value={contact.state}
                    onChange={handleContactChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    name="zip"
                    placeholder="91730"
                    value={contact.zip}
                    onChange={handleContactChange}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Internal notes (tech-only)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="Any internal notes about the customer you want future techs to see."
                  value={contact.notes}
                  onChange={handleContactChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Vehicle card */}
          <Card className="border-slate-800/80 bg-slate-900/80 shadow-[0_18px_55px_rgba(15,23,42,0.85)] backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                  <Car className="h-4 w-4 text-emerald-400" />
                  2. Vehicle details
                </CardTitle>
                <p className="text-xs text-slate-400">
                  Lock in the exact car we repaired so their portal can show
                  vehicle-specific history.
                </p>
              </div>
              <MapPin className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    name="make"
                    placeholder="Toyota"
                    value={vehicle.make}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    name="model"
                    placeholder="Camry"
                    value={vehicle.model}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    name="year"
                    placeholder="2021"
                    value={vehicle.year}
                    onChange={handleVehicleChange}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    name="color"
                    placeholder="White"
                    value={vehicle.color}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="vin">VIN</Label>
                  <Input
                    id="vin"
                    name="vin"
                    placeholder="Optional but ideal"
                    value={vehicle.vin}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="license_plate">License plate</Label>
                  <Input
                    id="license_plate"
                    name="license_plate"
                    placeholder="8ABC123"
                    value={vehicle.license_plate}
                    onChange={handleVehicleChange}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="insurance_carrier">
                    Insurance carrier (optional)
                  </Label>
                  <Input
                    id="insurance_carrier"
                    name="insurance_carrier"
                    placeholder="GEICO, State Farm, etc."
                    value={vehicle.insurance_carrier}
                    onChange={handleVehicleChange}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="body_type">
                    Body type (optional – sedan, SUV, etc.)
                  </Label>
                  <Input
                    id="body_type"
                    name="body_type"
                    placeholder="Sedan, SUV, Truck..."
                    value={vehicle.body_type}
                    onChange={handleVehicleChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repair card */}
          <Card className="border-slate-800/80 bg-slate-900/80 shadow-[0_18px_55px_rgba(15,23,42,0.85)] backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-50">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  3. Repair, invoice & warranty
                </CardTitle>
                <p className="text-xs text-slate-400">
                  Document what you fixed, what they&apos;re covered for, and
                  what they paid.
                </p>
              </div>
              <FileText className="h-4 w-4 text-slate-400" />
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,_2fr)_minmax(0,_1.5fr)]">
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="service_date">Service date</Label>
                      <div className="relative">
                        <Input
                          id="service_date"
                          name="service_date"
                          type="date"
                          value={repair.service_date}
                          onChange={handleRepairChange}
                        />
                        <CalendarIcon className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="coverage_type">Coverage type</Label>
                      <Input
                        id="coverage_type"
                        name="coverage_type"
                        placeholder="Rock chip repair – lifetime"
                        value={repair.coverage_type}
                        onChange={handleRepairChange}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="expiration_date">Warranty expires</Label>
                      <div className="relative">
                        <Input
                          id="expiration_date"
                          name="expiration_date"
                          type="date"
                          value={repair.expiration_date}
                          onChange={handleRepairChange}
                        />
                        <CalendarIcon className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="invoice_total">Invoice total</Label>
                      <div className="relative">
                        <Input
                          id="invoice_total"
                          name="invoice_total"
                          placeholder="120.00"
                          value={repair.invoice_total}
                          onChange={handleRepairChange}
                        />
                        <DollarSign className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="amount_paid">Amount paid</Label>
                      <Input
                        id="amount_paid"
                        name="amount_paid"
                        placeholder="120.00"
                        value={repair.amount_paid}
                        onChange={handleRepairChange}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="payment_method">Payment method</Label>
                      <Input
                        id="payment_method"
                        name="payment_method"
                        placeholder="Card, cash, etc."
                        value={repair.payment_method}
                        onChange={handleRepairChange}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,_1.4fr)_minmax(0,_1.6fr)]">
                    <div className="space-y-1">
                      <Label htmlFor="service_performed">Service performed</Label>
                      <Input
                        id="service_performed"
                        name="service_performed"
                        placeholder="Windshield chip repair – driver side"
                        value={repair.service_performed}
                        onChange={handleRepairChange}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="warranty_number">
                        Warranty number (optional override)
                      </Label>
                      <Input
                        id="warranty_number"
                        name="warranty_number"
                        placeholder="Auto-generated if left empty"
                        value={repair.warranty_number}
                        onChange={handleRepairChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <WindshieldSpotPicker
                    value={repair.repair_spot}
                    onChange={(value) =>
                      setRepair((prev) => ({ ...prev, repair_spot: value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="internal_notes">Invoice notes (internal)</Label>
                  <Textarea
                    id="internal_notes"
                    name="internal_notes"
                    rows={3}
                    placeholder="Anything you want future techs to know about how this repair was done."
                    value={repair.internal_notes}
                    onChange={handleRepairChange}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="customer_facing_notes">
                    Warranty notes (shown to customer)
                  </Label>
                  <Textarea
                    id="customer_facing_notes"
                    name="customer_facing_notes"
                    rows={3}
                    placeholder="Quick explanation the customer will see in their portal."
                    value={repair.customer_facing_notes}
                    onChange={handleRepairChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/90 px-4 py-3 shadow-[0_18px_55px_rgba(15,23,42,0.85)] md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-xs text-slate-300/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>
                  When you click{" "}
                  <span className="font-semibold text-emerald-300">
                    Create portal
                  </span>
                  , we&apos;ll:
                </span>
              </div>
              <ul className="ml-6 list-disc space-y-1 text-[11px] text-slate-400">
                <li>Create or update their record in <code>app_users</code>.</li>
                <li>Create / link a CRM record in <code>clients</code>.</li>
                <li>Attach a vehicle row in <code>vehicles</code>.</li>
                <li>Write a paid invoice in <code>tech_invoices</code>.</li>
                <li>
                  Generate and store a warranty row in <code>warranties</code>,
                  including <code>spot_location</code> and vehicle snapshot.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => router.back()}
                className="border-slate-700/80 text-xs text-slate-300"
              >
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isPrimaryActionDisabled}
                onClick={handleCreate}
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-cyan-400"
              >
                {mutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating portal…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Create portal & link records
                  </span>
                )}
              </Button>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
              <p>{successMessage}</p>
            </div>
          )}
        </motion.section>

        {/* Right: Snapshot + Email */}
        <motion.aside
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Snapshot */}
          <Card className="border-slate-800/80 bg-slate-900/90 shadow-[0_22px_60px_rgba(15,23,42,0.9)] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-50">
                <span>Portal snapshot</span>
                <span className="text-[11px] font-normal text-slate-400">
                  What the portal will know on day one
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">
                    {contact.full_name || "Unnamed client"}
                  </span>
                  {contact.email && (
                    <span className="truncate text-[11px] text-slate-400">
                      {contact.email.toLowerCase()}
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1 text-[11px] text-slate-400">
                  <MapPin className="h-3 w-3" />
                  {contact.city || "City not set"},{" "}
                  {contact.state || "State"}{" "}
                  {contact.zip && <span>• {contact.zip}</span>}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <Car className="h-3.5 w-3.5 text-emerald-400" />
                    Vehicle
                  </span>
                  <span className="text-slate-400">{vehicle.year || "----"}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-300">
                  {vehicle.make || "Make"} {vehicle.model || "Model"}{" "}
                  {vehicle.color && (
                    <span className="text-slate-400">• {vehicle.color}</span>
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    Warranty
                  </span>
                  <span className="text-slate-400">
                    {repair.expiration_date
                      ? `Expires ${repair.expiration_date}`
                      : "Expiration not set"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-300">
                  {repair.coverage_type || "Coverage details not set"}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Service:{" "}
                  {repair.service_performed || "Windshield repair not labeled"}
                </p>
                {repair.repair_spot && (
                  <p className="mt-1 text-[10px] text-emerald-300/90">
                    Spot: {labelSpot(repair.repair_spot)}
                  </p>
                )}
                {repair.warranty_number && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    Warranty #: {repair.warranty_number}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-cyan-400" />
                    Invoice
                  </span>
                  <span className="text-slate-400">
                    {repair.invoice_total ? `$${repair.invoice_total}` : "Total not set"}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {repair.payment_method
                    ? `Paid via ${repair.payment_method}`
                    : "Payment method not captured"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email invite */}
          <Card className="border-emerald-500/40 bg-slate-950/90 shadow-[0_22px_70px_rgba(16,185,129,0.45)] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold text-emerald-50">
                <span className="inline-flex items-center gap-2">
                  <Send className="h-4 w-4 text-emerald-300" />
                  Send upgraded portal invite
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-emerald-50/90">
              <p className="text-[11px] text-emerald-100/90">
                Send them the secure link to set a password and access their portal.
              </p>

              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-[11px] text-emerald-100/80">
                  <span className="font-medium">
                    To send, make sure email and dates are set.
                  </span>
                  <br />
                  Calls{" "}
                  <code className="rounded bg-emerald-500/20 px-1">
                    /api/email/old-client-portal-invite
                  </code>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={
                    emailSending ||
                    inviteRedirecting ||
                    !contact.email ||
                    !repair.service_date
                  }
                  onClick={handleSendEmail}
                  className="bg-emerald-500 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  {inviteRedirecting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Routing to customers…
                    </span>
                  ) : emailSending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending invite…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      Email portal invite
                    </span>
                  )}
                </Button>
              </div>

              {emailSentMessage && (
                <div className="mt-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/90">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-200" />
                    <div className="flex-1">
                      <p className="leading-relaxed">{emailSentMessage}</p>
                      {inviteRedirecting && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">
                          Redirecting
                          <ArrowRight className="h-3 w-3" />
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.aside>
      </div>
    </div>
  );
}

function ct(arg0: string) {
  throw new Error("Function not implemented.");
}
