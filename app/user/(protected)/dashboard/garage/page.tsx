// app/user/(protected)/dashboard/garage/page.tsx
"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Car,
  Plus,
  Info,
  Sparkles,
  Search,
  Trash,
  Edit3,
  Star,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabaseClient } from "@/lib/supabaseClient";
import VehicleCard, {
  Vehicle as VehicleType,
} from "@/components/user/dashboard/vehicles/VehicleCard";

type AnyObj = Record<string, any>;

export default function MyVehicles() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<AnyObj | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<AnyObj | null>(null);
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    vin: "",
    license_plate: "",
    insurance_carrier: "",
    // ✅ removed: photo_url
  });
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Local UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "year_desc" | "year_asc"
  >("newest");

  /* -------------------------------------------------------
     1) Auth bootstrap (Supabase session)
  ------------------------------------------------------- */
  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await supabaseClient.auth.getSession();
        const session = data?.session ?? null;

        if (!session?.user) {
          router.replace(
            `/user/login?redirect=${encodeURIComponent(
              "/user/dashboard/garage"
            )}`
          );
          return;
        }

        setUser({
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata || {},
        });
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, [router]);

  /* -------------------------------------------------------
     2) Vehicles query (by owner_email)
  ------------------------------------------------------- */
  const {
    data: vehicles = [],
    isLoading: vehiclesLoading,
  } = useQuery<VehicleType[]>({
    queryKey: ["my-vehicles", user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from("vehicles")
        .select("*")
        .eq("owner_email", user?.email)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as VehicleType[];
    },
    staleTime: 60_000,
  });

  const defaultVehicle = vehicles.find((v) => (v as AnyObj).is_default);
  const totalVehicles = vehicles.length;
  // newest = index 0 (since ordered created_at DESC)
  const lastAddedVehicle = vehicles[0];

  const resetForm = () => {
    setFormData({
      make: "",
      model: "",
      year: new Date().getFullYear(),
      color: "",
      vin: "",
      license_plate: "",
      insurance_carrier: "",
      // ✅ removed: photo_url
    });
    setEditingVehicle(null);
    setErrorMsg("");
  };

  /* -------------------------------------------------------
     3) Optimistic Mutations (create / update / delete)
  ------------------------------------------------------- */

  const createMutation = useMutation({
    mutationFn: async (data: AnyObj) => {
      if (!user?.email) throw new Error("Missing user email");

      const isDefault = (vehicles?.length || 0) === 0;

      const payload = {
        ...data,
        owner_email: user.email,
        is_default: isDefault,
        created_at: new Date().toISOString(),
      };

      const { data: resData, error } = await supabaseClient
        .from("vehicles")
        .insert(payload)
        .select("*");
      if (error) throw error;
      return Array.isArray(resData) ? resData[0] : resData;
    },
    onMutate: async (newVehicle) => {
      await queryClient.cancelQueries({
        queryKey: ["my-vehicles", user?.email],
      });
      const previous =
        queryClient.getQueryData<VehicleType[]>([
          "my-vehicles",
          user?.email,
        ]) || [];
      const temp = {
        ...(newVehicle as AnyObj),
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<VehicleType[] | undefined>(
        ["my-vehicles", user?.email],
        [temp as VehicleType, ...(previous || [])]
      );
      setDialogOpen(false);
      resetForm();
      return { previous };
    },
    onError: (err: any, _vars, context) => {
      setErrorMsg(err?.message || "Failed to save vehicle");
      if (context?.previous) {
        queryClient.setQueryData(
          ["my-vehicles", user?.email],
          context.previous
        );
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["my-vehicles", user?.email],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AnyObj }) => {
      const { data: res, error } = await supabaseClient
        .from("vehicles")
        .update(data)
        .eq("id", id)
        .select("*");
      if (error) throw error;
      return Array.isArray(res) ? res[0] : res;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["my-vehicles", user?.email],
      });
      const previous =
        queryClient.getQueryData<VehicleType[]>([
          "my-vehicles",
          user?.email,
        ]) || [];
      queryClient.setQueryData<VehicleType[] | undefined>(
        ["my-vehicles", user?.email],
        (old = []) =>
          old.map((v) =>
            v.id === id ? ({ ...v, ...(data as AnyObj) } as VehicleType) : v
          )
      );
      setDialogOpen(false);
      resetForm();
      return { previous };
    },
    onError: (err: any, _vars, context) => {
      setErrorMsg(err?.message || "Failed to update vehicle");
      if (context?.previous) {
        queryClient.setQueryData(
          ["my-vehicles", user?.email],
          context.previous
        );
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["my-vehicles", user?.email],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseClient
        .from("vehicles")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ["my-vehicles", user?.email],
      });
      const previous =
        queryClient.getQueryData<VehicleType[]>([
          "my-vehicles",
          user?.email,
        ]) || [];
      queryClient.setQueryData<VehicleType[] | undefined>(
        ["my-vehicles", user?.email],
        (old = []) => old.filter((v) => v.id !== id)
      );
      return { previous };
    },
    onError: (err: any, _vars, context) => {
      setErrorMsg(err?.message || "Failed to delete vehicle");
      if (context?.previous) {
        queryClient.setQueryData(
          ["my-vehicles", user?.email],
          context.previous
        );
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["my-vehicles", user?.email],
      });
    },
  });

  const handleSetDefault = async (id: string) => {
    try {
      const others = vehicles.filter(
        (v) => v.id !== id && (v as AnyObj).is_default
      );
      await Promise.all(
        others.map((v) =>
          supabaseClient
            .from("vehicles")
            .update({ is_default: false })
            .eq("id", v.id)
        )
      );
      await supabaseClient
        .from("vehicles")
        .update({ is_default: true })
        .eq("id", id);
      await queryClient.invalidateQueries({
        queryKey: ["my-vehicles", user?.email],
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to set default vehicle");
    }
  };

  /* -------------------------------------------------------
     4) Handlers
  ------------------------------------------------------- */

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (vehicle: AnyObj) => {
    setEditingVehicle(vehicle);
    setFormData({
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year ?? new Date().getFullYear(),
      color: vehicle.color || "",
      vin: vehicle.vin || "",
      license_plate: vehicle.license_plate || "",
      insurance_carrier: vehicle.insurance_carrier || "",
      // ✅ removed: photo_url
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this vehicle?")) {
      deleteMutation.mutate(id);
    }
  };

  /* -------------------------------------------------------
     5) Client-side search & sort
  ------------------------------------------------------- */
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    const term = searchQuery.trim().toLowerCase();
    let list = vehicles.filter((v) => {
      if (!term) return true;
      const fields = [
        v.make,
        v.model,
        String(v.year),
        v.vin,
        v.license_plate,
        v.insurance_carrier,
        v.color,
      ]
        .join(" ")
        .toLowerCase();
      return fields.includes(term);
    });

    switch (sortBy) {
      case "year_asc":
        list = list.sort((a, b) => (a.year || 0) - (b.year || 0));
        break;
      case "year_desc":
        list = list.sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      case "oldest":
        list = list.sort(
          (a, b) =>
            new Date(a.created_at as any).getTime() -
            new Date(b.created_at as any).getTime()
        );
        break;
      case "newest":
      default:
        list = list.sort(
          (a, b) =>
            new Date(b.created_at as any).getTime() -
            new Date(a.created_at as any).getTime()
        );
        break;
    }
    return list;
  }, [vehicles, searchQuery, sortBy]);

  /* -------------------------------------------------------
     6) Auth loading gate
  ------------------------------------------------------- */
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950">
        <div className="flex flex-col items-center gap-3">
          <Car className="w-8 h-8 animate-pulse text-sky-400" />
          <p className="text-sm text-slate-300">Loading your garage…</p>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     7) Main UI
  ------------------------------------------------------- */
  return (
    <div className="min-h-screen py-4 md:py-8 px-4 md:px-6 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-slate-100">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Hero / header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-950/95 via-slate-900/85 to-sky-900/50 px-5 py-6 md:px-8 md:py-7 shadow-[0_22px_60px_rgba(15,23,42,0.98)]"
        >
          {/* Glow accents */}
          <div className="pointer-events-none absolute -top-24 -left-10 h-52 w-52 rounded-full bg-sky-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-52 w-52 rounded-full bg-emerald-400/25 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light bg-[radial-gradient(circle_at_top,#1e293b_0,transparent_55%),radial-gradient(circle_at_bottom,#020617_0,transparent_60%)]" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70 text-[0.7rem] font-medium text-slate-300 mb-3">
                <Car className="w-3 h-3 text-sky-400" />
                MY GARAGE
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-50">
                Your Registered Vehicles
              </h1>
              <p className="mt-2 text-sm md:text-base text-slate-300/90 max-w-xl">
                Keep your cars on file so booking windshield repairs and warranty
                claims is as easy as a couple of taps.
              </p>
            </div>

            {/* Add Vehicle CTA */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-sky-500 hover:bg-sky-600 shadow-[0_0_24px_rgba(56,189,248,0.8)] text-xs md:text-sm rounded-full px-4 py-2.5 flex items-center"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {totalVehicles === 0 ? "Add Your First Vehicle" : "Add Vehicle"}
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-800 bg-slate-950/95 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.98)] rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-slate-50">
                    <Car className="w-5 h-5 text-sky-400" />
                    {editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
                  </DialogTitle>
                </DialogHeader>

                {errorMsg && (
                  <Alert
                    variant="destructive"
                    className="mb-3 border-red-500/70 bg-red-900/30 text-red-100"
                  >
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}

                {/* FORM */}
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="make"
                        className="text-xs font-medium text-slate-200"
                      >
                        Make *
                      </Label>
                      <Input
                        id="make"
                        value={formData.make}
                        onChange={(e) =>
                          setFormData({ ...formData, make: e.target.value })
                        }
                        placeholder="Toyota"
                        required
                        className="mt-1 !bg-slate-900/90 !text-slate-100 border-slate-700 placeholder:text-slate-400 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="model"
                        className="text-xs font-medium text-slate-200"
                      >
                        Model *
                      </Label>
                      <Input
                        id="model"
                        value={formData.model}
                        onChange={(e) =>
                          setFormData({ ...formData, model: e.target.value })
                        }
                        placeholder="Camry"
                        required
                        className="mt-1 !bg-slate-900/90 !text-slate-100 border-slate-700 placeholder:text-slate-400 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="year"
                        className="text-xs font-medium text-slate-200"
                      >
                        Year *
                      </Label>
                      <Input
                        id="year"
                        type="number"
                        value={formData.year}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            year:
                              parseInt(e.target.value, 10) ||
                              new Date().getFullYear(),
                          })
                        }
                        min={1900}
                        max={new Date().getFullYear() + 1}
                        required
                        className="mt-1 !bg-slate-900/90 !text-slate-100 border-slate-700 placeholder:text-slate-400 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="color"
                        className="text-xs font-medium text-slate-200"
                      >
                        Color
                      </Label>
                      <Input
                        id="color"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        placeholder="Black"
                        className="mt-1 !bg-slate-900/90 !text-slate-100 border-slate-700 placeholder:text-slate-400 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="license_plate"
                        className="text-xs font-medium text-slate-200"
                      >
                        License Plate
                      </Label>
                      <Input
                        id="license_plate"
                        value={formData.license_plate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            license_plate: e.target.value,
                          })
                        }
                        placeholder="ABC-1234"
                        className="mt-1 !bg-slate-900/90 !text-slate-100 border-slate-700 placeholder:text-slate-400 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="vin"
                        className="text-xs font-medium text-slate-200"
                      >
                        VIN
                      </Label>
                      <Input
                        id="vin"
                        value={formData.vin}
                        onChange={(e) =>
                          setFormData({ ...formData, vin: e.target.value })
                        }
                        placeholder="1HGBH41JXMN109186"
                        className="mt-1 !bg-slate-900/90 !text-slate-100 border-slate-700 placeholder:text-slate-400 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label
                        htmlFor="insurance_carrier"
                        className="text-xs font-medium text-slate-200"
                      >
                        Insurance Company (optional)
                      </Label>
                      <Input
                        id="insurance_carrier"
                        value={formData.insurance_carrier}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            insurance_carrier: e.target.value,
                          })
                        }
                        placeholder="State Farm"
                        className="mt-1 !bg-slate-900/90 !text-slate-100 border-slate-700 placeholder:text-slate-400 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[0.7rem] text-slate-400 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
                    <Info className="w-3 h-3 text-sky-400" />
                    Your first saved vehicle becomes the default for booking. You
                    can change this later from your garage.
                  </div>

                  <div className="flex gap-3 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1 border-slate-700 !bg-slate-900/90 text-slate-100 hover:!bg-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-sky-500 hover:bg-sky-600 shadow-[0_0_20px_rgba(56,189,248,0.7)]"
                      disabled={
                        createMutation.isPending || updateMutation.isPending
                      }
                    >
                      {editingVehicle
                        ? updateMutation.isPending
                          ? "Updating..."
                          : "Update Vehicle"
                        : createMutation.isPending
                        ? "Adding..."
                        : "Add Vehicle"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Quick stats row with Last Added */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {/* Total vehicles */}
          <Card className="border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] rounded-xl">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Total Vehicles
                </p>
                <p className="text-2xl font-semibold text-slate-50 tabular-nums">
                  {totalVehicles}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-sky-500/15 border border-sky-400/50 flex items-center justify-center">
                <Car className="w-5 h-5 text-sky-300" />
              </div>
            </CardContent>
          </Card>

          {/* Default vehicle */}
          <Card className="border border-emerald-700/70 bg-emerald-950/40 backdrop-blur-xl shadow-[0_18px_45px_rgba(4,120,87,0.7)] rounded-xl">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-200/80">
                  Default Vehicle
                </p>
                <p className="text-sm font-medium text-emerald-50 line-clamp-1">
                  {defaultVehicle
                    ? `${(defaultVehicle as AnyObj).year} ${
                        (defaultVehicle as AnyObj).make
                      } ${(defaultVehicle as AnyObj).model}`
                    : "Not set yet"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-400/70 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-50" />
              </div>
            </CardContent>
          </Card>

          {/* Last added vehicle */}
          <Card className="border border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.9)] hidden sm:block rounded-xl">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Last Added
                </p>
                {lastAddedVehicle ? (
                  <>
                    <p className="text-sm font-medium text-slate-50 line-clamp-1">
                      {(lastAddedVehicle as AnyObj).year}{" "}
                      {(lastAddedVehicle as AnyObj).make}{" "}
                      {(lastAddedVehicle as AnyObj).model}
                    </p>
                    {(lastAddedVehicle as AnyObj).license_plate && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Plate:{" "}
                        {(lastAddedVehicle as AnyObj)
                          .license_plate as string}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">
                    Add a vehicle to see it here.
                  </p>
                )}
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center">
                <Star className="w-4 h-4 text-sky-300" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search / controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="relative w-full md:w-2/3">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              aria-label="Search vehicles"
              placeholder="Search by make, model, year, VIN, plate, insurance..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-3 rounded-lg border border-slate-800/70 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-900/65 text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-slate-800/70 bg-slate-900/60 py-2 px-3 shadow-sm text-slate-100 text-sm"
              aria-label="Sort vehicles"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="year_desc">Sort: Year (High → Low)</option>
              <option value="year_asc">Sort: Year (Low → High)</option>
            </select>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery("");
                setSortBy("newest");
              }}
              className="px-3 py-2 rounded-lg text-sm text-slate-200 bg-transparent border border-white/10 hover:bg-slate-800/60"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Error banner (outside dialog) */}
        {errorMsg && !dialogOpen && (
          <Alert
            variant="destructive"
            className="border-red-500/70 bg-red-900/40 text-red-100"
          >
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Empty state / list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
        >
          {vehiclesLoading ? (
            <Card className="border border-slate-800/80 bg-slate-950/85 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.98)] rounded-xl">
              <CardContent className="py-16 flex flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-400">
                  Pulling your garage from the cloud…
                </p>
              </CardContent>
            </Card>
          ) : totalVehicles === 0 ? (
            <Card className="border border-slate-800/80 bg-slate-950/85 backdrop-blur-xl shadow-[0_22px_60px_rgba(15,23,42,0.98)] rounded-xl">
              <CardContent className="py-14 text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/90 border border-slate-700/80 mx-auto shadow-[0_0_30px_rgba(15,23,42,0.9)]">
                  <Car className="w-8 h-8 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-50 mb-1">
                    No Vehicles Yet
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Add your first vehicle to make booking repairs, tracking
                    warranties, and viewing past work lightning fast.
                  </p>
                </div>
                <Button
                  className="mt-2 bg-sky-500 hover:bg-sky-600 shadow-[0_0_22px_rgba(56,189,248,0.7)] rounded-full"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Vehicle
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map((vehicle, idx) => (
                <div
                  key={vehicle.id}
                  className="relative rounded-xl bg-slate-900/40 backdrop-blur-sm border border-slate-800/70 overflow-hidden transform-gpu hover:-translate-y-1 transition shadow-[0_12px_30px_rgba(2,6,23,0.7)]"
                >
                  <div className="p-4">
                    {/* Display-only VehicleCard */}
                    <VehicleCard vehicle={vehicle} index={idx} />

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-indigo-600 to-sky-500 text-white hover:from-indigo-700 hover:to-sky-600 shadow rounded-md"
                        onClick={() => handleEdit(vehicle as AnyObj)}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-none px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 shadow-sm"
                        onClick={() => handleDelete(vehicle.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                      <div>
                        <span className="font-medium text-slate-100">
                          {vehicle.year}
                        </span>
                        <span className="ml-2">
                          {vehicle.color || "Color not set"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-2 py-1 text-xs rounded-md border-slate-700 text-slate-100 bg-transparent hover:bg-slate-800/70"
                          onClick={() => handleSetDefault(vehicle.id)}
                          title="Set as default vehicle"
                        >
                          {vehicle.is_default ? "Default" : "Set Default"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}