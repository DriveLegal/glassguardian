// app/user/(protected)/dashboard/book/BookClient.tsx  (Client Component)
"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Tag,
  MapPin,
  Car,
  ChevronDown,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PhotoUploadAdvanced from "@/components/PhotoUploadAdvanced";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationService } from "@/components/AutomatedNotifications";
import { supabaseClient } from "@/lib/supabaseClient";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import { format } from "date-fns";

type AnyObj = Record<string, any>;

type Vehicle = {
  id: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  license_plate?: string | null;
  plate?: string | null;
};

type SavedAddress = {
  id: string;
  full_address: string;
  label?: string | null;
  is_default?: boolean | null;
};

const SERVICE_TYPES = [
  {
    value: "chip_repair",
    label: "Chip Repair (under 2 inches)",
    desc: "Small rock chips (about the size of a quarter or less)",
    price: 60,
  },
  {
    value: "crack_repair",
    label: "Crack Repair (2–4 inches)",
    desc: "Straight or spider cracks between 1.5 and 4 inches long",
    price: 100,
  },
  {
    value: "insurance",
    label: "Insurance Glass Claim",
    desc: "We bill your approved glass coverage so you pay no cost out of pocket. The insurance pays Glass Guardian Chip and Crack Repair directly.",
    price: 0, // handled as TBA in UI
  },
  {
    value: "inspection",
    label: "Damage Assessment",
    desc: "Not sure what you need? We’ll inspect and recommend the best option",
    price: 0,
  },
];

const DAMAGE_SIZES = [
  { value: "quarter", label: "Quarter Size", desc: "~1 inch" },
  { value: "half_dollar", label: "Half Dollar", desc: "~1.5 inches" },
  { value: "dollar", label: "Dollar Coin", desc: "~2 inches" },
  { value: "larger", label: "Larger", desc: "Over 2 inches" },
];

const PHOTOS_BUCKET = "photos"; // change if your bucket name differs

// 🔒 Operating hours (local time)
const OPERATING_START = "07:00"; // 7:00 AM
const OPERATING_END = "17:00"; // 5:00 PM

// Generate 30-min time options between operating hours
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  const [startH, startM] = OPERATING_START.split(":").map(Number);
  const [endH, endM] = OPERATING_END.split(":").map(Number);

  let h = startH;
  let m = startM;

  while (h < endH || (h === endH && m <= endM)) {
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    out.push(`${hh}:${mm}`);
    m += 30;
    if (m >= 60) {
      m -= 60;
      h += 1;
    }
  }
  return out;
})();

// Human readable label like "10:30 AM"
function formatTimeLabel(value: string): string {
  const [hStr, mStr] = value.split(":");
  let h = Number(hStr);
  const suffix = h >= 12 ? "PM" : "AM";
  const displayH = ((h + 11) % 12) + 1;
  return `${displayH}:${mStr} ${suffix}`;
}

// helper to turn a Date into a YYYY-MM-DD string WITHOUT timezone shift
function toLocalISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSupabaseErrorMessage(err: any): string {
  if (!err) return "Unknown error";

  // Supabase errors often have .message
  const msg = String(err?.message || "").trim();
  if (msg) return msg;

  // Sometimes errors come nested
  if (err?.error_description) return String(err.error_description);
  if (err?.details) return String(err.details);
  if (typeof err === "string") return err;

  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export default function BookClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") ?? undefined;

  const [user, setUser] = useState<AnyObj | null>(null);
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<AnyObj>({
    vehicle_id: "",
    service_type: "",
    damage_size: "",
    damage_description: "",
    service_address: "",
    location_type: "mobile",
    scheduled_date: "", // stored as YYYY-MM-DD
    scheduled_time_start: "",
    scheduled_time_end: "",
    notes_customer: "",
    coupon_code: "",
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [photos, setPhotos] = useState<any[]>([]);
  const [error, setError] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<AnyObj | null>(null);

  // local state for custom vehicle dropdown
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const vehicleDropdownRef = useRef<HTMLDivElement | null>(null);

  // saved address dropdown
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const addressDropdownRef = useRef<HTMLDivElement | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);

  // calendar popover
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // --- click outside to close dropdowns ---
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        vehicleDropdownRef.current &&
        !vehicleDropdownRef.current.contains(e.target as Node)
      ) {
        setVehicleOpen(false);
      }
      if (
        addressDropdownRef.current &&
        !addressDropdownRef.current.contains(e.target as Node)
      ) {
        setAddressDropdownOpen(false);
      }
    }
    if (vehicleOpen || addressDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [vehicleOpen, addressDropdownOpen]);

  // Load current user (from Supabase auth) and prefill address; store referralCode once
  useEffect(() => {
    (async () => {
      const { data } = await supabaseClient.auth.getSession();
      const session = data?.session || null;
      const sUser = session?.user || null;
      if (!sUser) {
        router.push(
          `/user/login?redirect=${encodeURIComponent(
            "/user/dashboard/appointments/book"
          )}`
        );
        return;
      }

      const localUser: AnyObj = {
        id: sUser.id,
        email: sUser.email,
        user_metadata: sUser.user_metadata || {},
      };
      setUser(localUser);

      const { data: profileRow } = await supabaseClient
        .from("app_users")
        .select("address_line1, city, state, zip, referred_by")
        .eq("auth_user_id", sUser.id)
        .maybeSingle();

      if (profileRow?.address_line1) {
        setFormData((prev: AnyObj) => ({
          ...prev,
          service_address: `${profileRow.address_line1}${
            profileRow.city ? `, ${profileRow.city}` : ""
          }${profileRow.state ? `, ${profileRow.state}` : ""}${
            profileRow.zip ? ` ${profileRow.zip}` : ""
          }`,
        }));
      }

      if (referralCode && !profileRow?.referred_by) {
        await supabaseClient
          .from("app_users")
          .update({ referred_by: referralCode })
          .eq("auth_user_id", sUser.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCode]);

  // hydrate selectedDate from scheduled_date if needed (e.g., returning to step 3)
  useEffect(() => {
    if (formData.scheduled_date && !selectedDate) {
      const parts = formData.scheduled_date.split("-");
      if (parts.length === 3) {
        const [y, m, d] = parts.map((p: string) => Number(p));
        if (y && m && d) {
          setSelectedDate(new Date(y, m - 1, d));
        }
      }
    }
  }, [formData.scheduled_date, selectedDate]);

  // Track preview URLs for cleanup
  const currentPhotosRef = useRef<any[]>([]);
  useEffect(() => {
    currentPhotosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      currentPhotosRef.current.forEach((p) => {
        if (p.preview) URL.revokeObjectURL(p.preview);
      });
    };
  }, []);

  // Vehicles for current user
  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["my-vehicles", user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select("*")
        .eq("owner_email", user?.email);
      if (error) throw error;
      return (data as Vehicle[]) || [];
    },
    staleTime: 60_000,
  });

  // Saved addresses for current user
  const { data: savedAddresses = [] } = useQuery<SavedAddress[]>({
    queryKey: ["user-addresses", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("user_addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as SavedAddress[]) || [];
    },
    staleTime: 60_000,
  });

  // Active coupons
  const { data: coupons = [] } = useQuery({
    queryKey: ["active-coupons"],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("coupons")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const coupon = coupons.find(
        (c: any) => c.code?.toLowerCase() === code.toLowerCase()
      );
      if (!coupon) throw new Error("Invalid coupon code");

      if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
        throw new Error("Coupon has reached maximum uses");
      }

      const todayStr = new Date().toISOString().split("T")[0];
      if (coupon.valid_from && coupon.valid_from > todayStr)
        throw new Error("Coupon not yet valid");
      if (coupon.valid_until && coupon.valid_until < todayStr)
        throw new Error("Coupon has expired");

      return coupon;
    },
    onSuccess: (coupon: any) => {
      setAppliedCoupon(coupon);
      const selectedService = SERVICE_TYPES.find(
        (s) => s.value === formData.service_type
      );
      const basePrice = selectedService?.price || 0;

      let discountAmount = 0;
      if (coupon.discount_type === "percentage") {
        discountAmount = basePrice * (coupon.discount_value / 100);
      } else if (coupon.discount_type === "fixed") {
        discountAmount = coupon.discount_value;
      }
      setDiscount(discountAmount);
      setError("");
    },
    onError: (err: any) => {
      setError(getSupabaseErrorMessage(err));
      setAppliedCoupon(null);
      setDiscount(0);
    },
  });

  // Helper: upload a file to Supabase Storage and return public URL (or path)
  async function uploadPhotoAndGetUrl(
    file: File,
    appointmentId: string,
    type: string
  ) {
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${appointmentId}/${type}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseClient.storage
      .from(PHOTOS_BUCKET)
      .upload(filename, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (upErr) throw upErr;

    const { data: publicUrlData } = supabaseClient.storage
      .from(PHOTOS_BUCKET)
      .getPublicUrl(filename);

    return publicUrlData.publicUrl ?? filename;
  }

  // Fetch "referred_by" for current user from users table
  async function getReferredByAndEmail() {
  if (!user?.id) {
    return { referred_by: null, email: user?.email || null };
  }

  const { data, error } = await supabaseClient
    .from("app_users")
    .select("email, invite_code")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return { referred_by: null, email: user?.email || null };
  }

  return {
    // NOTE: there is no referred_by in your schema
    referred_by: null,
    email: data?.email || user?.email || null,
    invite_code: data?.invite_code || null,
  };
}

  // ✅ Validate time window against operating hours (optional field)
  function validateTimeWindow(): string | null {
    const start = formData.scheduled_time_start;
    const end = formData.scheduled_time_end;

    if (!start && !end) return null;

    if (!start || !end) {
      return "Please provide a full time window (start and end) within our operating hours (7:00 AM – 5:00 PM).";
    }

    if (start >= end) return "End time must be later than start time.";

    if (start < OPERATING_START || end > OPERATING_END) {
      return "Please choose a time between 7:00 AM and 5:00 PM.";
    }

    return null;
  }

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AnyObj) => {
      if (!user?.email) throw new Error("No user email");

      const { _saveAddress, ...appointmentForm } = data;

      const selectedService = SERVICE_TYPES.find(
        (s) => s.value === appointmentForm.service_type
      );
      const basePrice = selectedService?.price || 0;
      const finalPrice = Math.max(0, basePrice - discount);

      // ✅ IMPORTANT: Do NOT spread unknown keys into appointments insert.
      // This avoids "column does not exist" hard failures (like coupon_code).
      const appointmentInsert: AnyObj = {
        vehicle_id: appointmentForm.vehicle_id,
        service_type: appointmentForm.service_type,
        damage_size: appointmentForm.damage_size || null,
        damage_description: appointmentForm.damage_description || null,

        service_address: appointmentForm.service_address,
        location_type: appointmentForm.location_type || "mobile",

        scheduled_date: appointmentForm.scheduled_date,
        scheduled_time_start: appointmentForm.scheduled_time_start || null,
        scheduled_time_end: appointmentForm.scheduled_time_end || null,

        notes_customer: appointmentForm.notes_customer || null,

        customer_email: user.email,
        technician_email: null,
        status: "estimating",
        estimate_amount: finalPrice,
        created_at: new Date().toISOString(),
      };

      // 1) Create appointment (critical)
      const { data: apt, error: aptErr } = await supabaseClient
        .from("appointments")
        .insert(appointmentInsert)
        .select("*")
        .single();

      if (aptErr) {
        // Log full error for debugging in console
        console.error("APPOINTMENT INSERT ERROR:", aptErr, {
          appointmentInsert,
        });
        throw aptErr;
      }
      if (!apt) throw new Error("Failed to create appointment (no row returned)");

      // 2) Upload photos + insert rows (best effort, but still can throw if you want it strict)
      // If you want bookings to succeed even if photos fail, wrap the loop in try/catch and don't throw.
      for (const photo of photos) {
        const fileUrl = await uploadPhotoAndGetUrl(photo.file, apt.id, photo.type);

        const photoInsert: AnyObj = {
          appointment_id: apt.id,
          photo_type: photo.type,
          file_url: fileUrl,
          uploaded_by: user.email,
          created_at: new Date().toISOString(),
        };

        const { error: pErr } = await supabaseClient.from("photos").insert(photoInsert);
        if (pErr) {
          console.error("PHOTO INSERT ERROR:", pErr, { photoInsert });
          throw pErr;
        }
      }

      // 3) Save address if requested (best effort)
      if (_saveAddress && appointmentForm.service_address?.trim()) {
        const { error: addrErr } = await supabaseClient.from("user_addresses").insert({
          user_id: user.id,
          full_address: appointmentForm.service_address.trim(),
        });
        if (addrErr) console.error("SAVE ADDRESS ERROR:", addrErr);
      }

      // 4) Update coupon usage if applied (best effort)
      if (appliedCoupon) {
        const { error: coupErr } = await supabaseClient
          .from("coupons")
          .update({ times_used: (appliedCoupon.times_used || 0) + 1 })
          .eq("id", appliedCoupon.id);

        if (coupErr) console.error("COUPON UPDATE ERROR:", coupErr);
      }

      // 5) Create referral record if user was referred (best effort)
      try {
        const { referred_by } = await getReferredByAndEmail();
        if (referred_by) {
          const { data: referrers, error: r1Err } = await supabaseClient
            .from("app_users")
            .select("email")
            .eq("referral_code", referred_by)
            .limit(1);

          if (r1Err) console.error("REFERRER LOOKUP ERROR:", r1Err);

          const refEmail = referrers?.[0]?.email;
          if (refEmail) {
            const { error: refErr } = await supabaseClient.from("referrals").insert({
              referrer_email: refEmail,
              referred_email: user.email,
              referral_code: referred_by,
              status: "pending",
              first_appointment_id: apt.id,
              created_at: new Date().toISOString(),
            });
            if (refErr) console.error("REFERRAL INSERT ERROR:", refErr);
          }
        }
      } catch (e) {
        console.error("REFERRAL FLOW ERROR:", e);
      }

      // 6) Send booking confirmation (best effort)
      try {
        await NotificationService.sendNotification({
          recipientEmail: user.email,
          notificationType: "appointment_booked",
          appointmentId: apt.id,
          customData: { appointmentId: apt.id },
        });
      } catch (e) {
        console.error("NOTIFICATION ERROR:", e);
      }

      return apt;
    },
    onSuccess: (appointment: any) => {
      queryClient.invalidateQueries({
        queryKey: ["my-appointments", user?.email],
      });
      queryClient.invalidateQueries({
        queryKey: ["user-addresses", user?.id],
      });
      router.push(`/user/dashboard/appointments/${appointment.id}`);
    },
    onError: (err: any) => {
      const msg = getSupabaseErrorMessage(err);
      setError(msg || "Failed to create appointment. Please try again.");
    },
  });

  const handlePhotoUpload = async (file: File | null, photoType: string) => {
    setPhotos((prev) => {
      const existing = prev.find((p) => p.type === photoType);
      if (existing?.preview) URL.revokeObjectURL(existing.preview);

      const updated = prev.filter((p) => p.type !== photoType);
      if (file) {
        const previewUrl = URL.createObjectURL(file);
        return [...updated, { file, type: photoType, preview: previewUrl }];
      }
      return updated;
    });
  };

  const handleApplyCoupon = () => {
    if (formData.coupon_code.trim()) {
      applyCouponMutation.mutate(formData.coupon_code);
    }
  };

  const handleSubmit = () => {
    setError("");

    if (!formData.vehicle_id || !formData.service_type) {
      setError("Please fill in all required fields");
      return;
    }

    const timeError = validateTimeWindow();
    if (timeError) {
      setError(timeError);
      return;
    }

    createAppointmentMutation.mutate({
      ...formData,
      _saveAddress: saveAddress,
    });
  };

  const selectedService = SERVICE_TYPES.find((s) => s.value === formData.service_type);
  const basePrice = selectedService?.price || 0;
  const finalPrice = Math.max(0, basePrice - discount);

  const selectedVehicle = vehicles.find((v) => v.id === formData.vehicle_id);

  const vehicleLabel = (v: Vehicle | undefined) => {
    if (!v) return "Select vehicle";
    const year = v.year ? `${v.year} ` : "";
    const make = v.make ?? "";
    const model = v.model ?? "";
    const color = v.color ? ` · ${v.color}` : "";
    const plate = (v.license_plate || v.plate || "").toUpperCase();
    const platePart = plate ? ` · ${plate}` : "";
    return `${year}${make} ${model}${color}${platePart}`.trim();
  };

  const currentAddressSummary =
    formData.service_address?.length > 0
      ? formData.service_address
      : "Select from saved addresses";

  /* ---------------- STEP 1 ---------------- */

  const renderStep1 = () => (
    <Card className="border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
      <CardHeader className="bg-gradient-to-r from-sky-900/70 to-cyan-900/70 border-b border-slate-800">
        <CardTitle className="text-2xl text-slate-50">Service Details</CardTitle>
        <p className="text-sm text-slate-300">
          Tell us about the damage on your glass.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Vehicle Selection */}
        <div>
          <Label htmlFor="vehicle" className="text-slate-200">
            Vehicle *
          </Label>
          {vehicles.length === 0 ? (
            <Alert className="mt-2 bg-slate-900/70 border-slate-700 text-slate-100">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Please{" "}
                <Link href="/user/dashboard/garage" className="text-sky-400 underline">
                  add a vehicle
                </Link>{" "}
                in your Garage first.
              </AlertDescription>
            </Alert>
          ) : (
            <div ref={vehicleDropdownRef} className="relative mt-2">
              <button
                type="button"
                onClick={() => setVehicleOpen((open) => !open)}
                className="w-full inline-flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm shadow-sm hover:border-sky-400 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 transition-all text-slate-50"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 border border-sky-400/40">
                    <Car className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[0.7rem] font-medium text-slate-400">
                      Selected Vehicle
                    </span>
                    <span className="text-sm font-semibold text-slate-50 truncate max-w-[220px] md:max-w-[320px]">
                      {vehicleLabel(selectedVehicle)}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    vehicleOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {vehicleOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute z-50 mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/95 bg-clip-padding shadow-2xl backdrop-blur-xl overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-slate-800/70 bg-gradient-to-r from-sky-500/15 to-cyan-500/10">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-300">
                        Your Garage
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Choose the vehicle with the damaged glass.
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {vehicles.map((v) => {
                        const label = vehicleLabel(v);
                        const isActive = v.id === formData.vehicle_id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setFormData((prev: AnyObj) => ({
                                ...prev,
                                vehicle_id: v.id,
                              }));
                              setVehicleOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 text-sm transition ${
                              isActive
                                ? "bg-sky-600/25 text-sky-50"
                                : "text-slate-100 hover:bg-slate-800/70"
                            }`}
                          >
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl border text-[0.8rem] ${
                                isActive
                                  ? "border-sky-300/70 bg-sky-500/30"
                                  : "border-slate-700/80 bg-slate-900/60"
                              }`}
                            >
                              <Car className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold leading-tight">
                                {label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-800/70 px-3 py-2 bg-slate-950/90 text-[0.72rem] text-slate-400 flex justify-between items-center">
                      <span>
                        Need to add another car? Use your{" "}
                        <span className="font-semibold text-sky-300">Garage</span>{" "}
                        tab.
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Service Type */}
        <div>
          <Label className="text-slate-200">Service Type *</Label>
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            {SERVICE_TYPES.map((type) => {
              const isSelected = formData.service_type === type.value;
              const showNoCost = type.value === "insurance";
              return (
                <div
                  key={type.value}
                  onClick={() =>
                    setFormData((prev: AnyObj) => ({
                      ...prev,
                      service_type: type.value,
                    }))
                  }
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                    isSelected
                      ? "border-sky-500 bg-sky-900/60"
                      : "border-slate-700 bg-slate-900/80 hover:border-sky-400"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-50">{type.label}</h3>
                    {!showNoCost && type.price > 0 && (
                      <Badge
                        variant="outline"
                        className="text-sky-300 border-sky-400/80 bg-sky-900/40"
                      >
                        ${type.price}
                      </Badge>
                    )}
                    {showNoCost && (
                      <Badge
                        variant="outline"
                        className="text-sky-300 border-sky-400/80 bg-amber-900/40"
                      >
                        NO COST
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">{type.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Damage Size */}
        {formData.service_type && formData.service_type !== "inspection" && (
          <div>
            <Label className="text-slate-200">Damage Size</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {DAMAGE_SIZES.map((size) => (
                <motion.div
                  key={size.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    setFormData((prev: AnyObj) => ({
                      ...prev,
                      damage_size: size.value,
                    }))
                  }
                  className={`p-4 rounded-xl border-2 cursor-pointer text-center transition-all shadow-md hover:shadow-lg ${
                    formData.damage_size === size.value
                      ? "border-sky-500 bg-sky-900/60 shadow-sky-500/20"
                      : "border-slate-700 bg-slate-900/80 hover:border-sky-400"
                  }`}
                >
                  <p className="font-bold text-sm text-slate-50">{size.label}</p>
                  <p className="text-xs text-slate-300 mt-1">{size.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <Label htmlFor="description" className="text-slate-200">
            Damage Description
          </Label>
          <Textarea
            id="description"
            placeholder="Describe the location and type of damage..."
            value={formData.damage_description}
            onChange={(e) =>
              setFormData((prev: AnyObj) => ({
                ...prev,
                damage_description: e.target.value,
              }))
            }
            className="mt-2 bg-slate-900/80 border-slate-700 text-black-50 placeholder:text-slate-500"
            rows={3}
          />
        </div>

        <Button
          onClick={() => setStep(2)}
          className="w-full bg-sky-600 hover:bg-sky-700 shadow-[0_12px_30px_rgba(56,189,248,0.4)]"
          disabled={!formData.vehicle_id || !formData.service_type}
        >
          Continue to Photos
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );

  /* ---------------- STEP 2 ---------------- */

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      key="step2"
    >
      <Card className="border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-50">
            Upload Photos <span className="text-sm text-sky-300">(Optional)</span>
          </CardTitle>
          <p className="text-sm text-slate-300">
            A clear close-up helps us confirm if it qualifies for repair vs replacement.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Only one optional photo: Close-up */}
          <div className="space-y-2">
            <PhotoUploadAdvanced
              photoType="damage_closeup"
              label="Close-up of Damage"
              required={false}
              onUploadAction={handlePhotoUpload}
              existingPhoto={photos.find((p) => p.type === "damage_closeup")?.preview}
            />
            <p className="text-xs text-sky-400">
              Optional, but highly recommended — the clearer the close-up, the faster we can lock in your estimate.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              className="flex-1 rounded-full border border-slate-700 text-slate-100 hover:text-slate-100 hover:bg-slate-900/70"
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              className="flex-1 bg-sky-600 hover:bg-sky-700 shadow-[0_12px_30px_rgba(56,189,248,0.4)]"
            >
              Continue to Scheduling
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  /* ---------------- STEP 3 ---------------- */

  const renderStep3 = () => {
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const maxDate = new Date(
      todayLocal.getFullYear(),
      todayLocal.getMonth() + 1,
      todayLocal.getDate()
    );

    const fromOptions = TIME_OPTIONS.slice(0, -1);
    const toOptions =
      formData.scheduled_time_start
        ? TIME_OPTIONS.filter((t) => t > formData.scheduled_time_start)
        : TIME_OPTIONS.slice(1);

    return (
      <Card className="border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-50">Schedule & Pricing</CardTitle>
          <p className="text-sm text-slate-300">When and where should we come?</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Service Location — mobile only */}
          <div>
            <Label className="text-slate-200">Service Location</Label>
            <div className="mt-3 rounded-xl border border-sky-500/60 bg-sky-900/40 p-4 flex items-start gap-3">
              <div className="mt-1">
                <MapPin className="w-5 h-5 text-sky-300" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-50">
                  Mobile Service (We Come to You)
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Our technician meets you at home, work, or wherever your car is parked.
                </p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="address" className="text-slate-200">
              Service Address *
            </Label>

            {savedAddresses.length > 0 && (
              <div ref={addressDropdownRef} className="relative mt-2 mb-3">
                <button
                  type="button"
                  onClick={() => setAddressDropdownOpen((open) => !open)}
                  className="w-full inline-flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs shadow-sm hover:border-sky-400 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 transition-all text-slate-100"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-[0.68rem] uppercase tracking-[0.16em] text-slate-400">
                      Saved Addresses
                    </span>
                    <span className="truncate">{currentAddressSummary}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      addressDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {addressDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto py-1">
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => {
                              setFormData((prev: AnyObj) => ({
                                ...prev,
                                service_address: addr.full_address,
                              }));
                              setAddressDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-slate-100 hover:bg-slate-800/80"
                          >
                            {addr.label && (
                              <span className="block text-[0.65rem] uppercase tracking-[0.16em] text-sky-300 mb-0.5">
                                {addr.label}
                              </span>
                            )}
                            <span className="block">{addr.full_address}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <Textarea
              id="address"
              placeholder="Enter full address..."
              value={formData.service_address}
              onChange={(e) =>
                setFormData((prev: AnyObj) => ({
                  ...prev,
                  service_address: e.target.value,
                }))
              }
              className="mt-2 bg-slate-900/80 border-slate-700 text-black-50 placeholder:text-slate-500"
              rows={2}
            />

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <input
                id="save-address"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
              />
              <label htmlFor="save-address">Save this address to your profile for next time</label>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-slate-200">
                Preferred Date *
              </Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="mt-2 w-full inline-flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 text-sm shadow-sm hover:border-sky-400 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 transition-all"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 border border-sky-400/40">
                        <CalendarDays className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                          Preferred Date
                        </span>
                        <span className="text-sm font-semibold text-slate-50">
                          {selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : "Choose a date"}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  className="w-auto p-0 border-slate-800 bg-slate-950 text-slate-50 rounded-xl shadow-xl"
                >
                  <DatePickerCalendar
                    mode="single"
                    selected={selectedDate ?? undefined}
                    onSelect={(date) => {
                      if (!date) {
                        setSelectedDate(null);
                        setFormData((prev: AnyObj) => ({ ...prev, scheduled_date: "" }));
                        setDatePopoverOpen(false);
                        return;
                      }

                      const iso = toLocalISODate(date);

                      if (formData.scheduled_date === iso) {
                        setSelectedDate(null);
                        setFormData((prev: AnyObj) => ({ ...prev, scheduled_date: "" }));
                        setDatePopoverOpen(false);
                        return;
                      }

                      setSelectedDate(date);
                      setFormData((prev: AnyObj) => ({ ...prev, scheduled_date: iso }));
                      setDatePopoverOpen(false);
                    }}
                    disabled={(date) => date < todayLocal || date > maxDate}
                    fromDate={todayLocal}
                    toDate={maxDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="time" className="text-slate-200">
                Time Window
              </Label>
              <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400 mb-1">
                      From
                    </p>
                    <select
                      value={formData.scheduled_time_start}
                      onChange={(e) => {
                        setError("");
                        const value = e.target.value;
                        setFormData((prev: AnyObj) => ({
                          ...prev,
                          scheduled_time_start: value,
                          scheduled_time_end:
                            prev.scheduled_time_end && prev.scheduled_time_end > value
                              ? prev.scheduled_time_end
                              : "",
                        }));
                      }}
                      className="h-9 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 text-xs text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                    >
                      <option value="">Select time</option>
                      {fromOptions.map((t) => (
                        <option key={t} value={t}>
                          {formatTimeLabel(t)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <p className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-400 mb-1">
                      To
                    </p>
                    <select
                      value={formData.scheduled_time_end}
                      onChange={(e) => {
                        setError("");
                        setFormData((prev: AnyObj) => ({
                          ...prev,
                          scheduled_time_end: e.target.value,
                        }));
                      }}
                      className="h-9 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 text-xs text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
                    >
                      <option value="">Select time</option>
                      {toOptions.map((t) => (
                        <option key={t} value={t}>
                          {formatTimeLabel(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="mt-2 text-[0.7rem] text-slate-400">
                  Operating hours: 7:00 AM – 5:00 PM (local time).
                </p>
              </div>
            </div>
          </div>

          {/* Coupon Code */}
          <div>
            <Label htmlFor="coupon" className="text-slate-200">
              Promo Code
            </Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="coupon"
                placeholder="Enter code"
                value={formData.coupon_code}
                onChange={(e) => {
                  setFormData((prev: AnyObj) => ({
                    ...prev,
                    coupon_code: e.target.value.toUpperCase(),
                  }));
                  setError("");
                  setAppliedCoupon(null);
                  setDiscount(0);
                }}
                className="bg-slate-900/80 border-slate-700 text-slate-50 placeholder:text-slate-500"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleApplyCoupon}
                disabled={!formData.coupon_code || applyCouponMutation.isPending}
                className="border-slate-700 text-black-100 hover:bg-slate-900"
              >
                {applyCouponMutation.isPending ? (
                  "Applying..."
                ) : (
                  <>
                    <Tag className="w-4 h-4 mr-2" /> Apply
                  </>
                )}
              </Button>
            </div>

            {appliedCoupon && (
              <Alert className="mt-2 bg-emerald-900/30 border-emerald-500/60 text-emerald-100">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <AlertDescription>
                  <strong>{appliedCoupon.code}</strong> applied! You save ${discount.toFixed(2)}
                </AlertDescription>
              </Alert>
            )}

            {applyCouponMutation.isError && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {(applyCouponMutation.error as any)?.message}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Price Summary */}
          <div className="p-4 bg-slate-900/80 rounded-lg border border-slate-700">
            {!selectedService ? (
              <p className="text-sm text-slate-400">Select a service type to see pricing.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Service:</span>
                  <span className="font-medium text-slate-50">${basePrice.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-300">
                    <span>Discount:</span>
                    <span className="font-medium">-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-100">Total:</span>
                    <span className="text-2xl font-bold text-emerald-300">
                      ${finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Special Notes */}
          <div>
            <Label htmlFor="notes" className="text-slate-200">
              Special Instructions
            </Label>
            <Textarea
              id="notes"
              placeholder="Gate codes, parking instructions, pets, etc..."
              value={formData.notes_customer}
              onChange={(e) =>
                setFormData((prev: AnyObj) => ({
                  ...prev,
                  notes_customer: e.target.value,
                }))
              }
              className="mt-2 bg-slate-900/80 border-slate-700 text-black-50 placeholder:text-slate-500"
              rows={2}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setStep(2)}
              className="flex-1 rounded-full border border-slate-700 text-slate-100 hover:text-slate-100 hover:bg-slate-900/70"
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back
            </Button>

            <Button
              onClick={handleSubmit}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-[0_12px_30px_rgba(16,185,129,0.4)]"
              disabled={
                createAppointmentMutation.isPending ||
                !formData.service_address ||
                !formData.scheduled_date
              }
            >
              {createAppointmentMutation.isPending ? "Creating..." : "Submit Request"}
              <CheckCircle className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  /* ---------------- ROOT ---------------- */

  return (
    <div className="min-h-[100dvh] p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <motion.div
                  animate={s === step ? { scale: [1, 1.1, 1] } : {}}
                  transition={{
                    duration: 0.5,
                    repeat: s === step ? Infinity : 0,
                    repeatDelay: 1,
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all shadow-lg ${
                    s === step
                      ? "bg-gradient-to-br from-sky-600 to-sky-700 text-white shadow-sky-500/50 scale-110"
                      : s < step
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {s < step ? <CheckCircle className="w-6 h-6" /> : s}
                </motion.div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-2 mx-3 rounded-full transition-all ${
                      s < step
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                        : "bg-slate-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm font-semibold">
            <span
              className={
                step === 1 ? "text-sky-300" : step > 1 ? "text-emerald-300" : "text-slate-500"
              }
            >
              Service Details
            </span>
            <span
              className={
                step === 2 ? "text-sky-300" : step > 2 ? "text-emerald-300" : "text-slate-500"
              }
            >
              Upload Photos
            </span>
            <span className={step === 3 ? "text-sky-300" : "text-slate-500"}>
              Schedule
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
            >
              {renderStep1()}
            </motion.div>
          )}
          {step === 2 && renderStep2()}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              {renderStep3()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}