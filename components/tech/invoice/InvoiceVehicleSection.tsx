// components/tech/invoice/InvoiceVehicleSection.tsx
"use client";

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Car } from "lucide-react";

type Vehicle = {
  id: string;
  owner_email: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  vin: string | null;
  license_plate: string | null;
  insurance_carrier?: string | null;
  is_default?: boolean | null;
};

type InvoiceVehicleSectionProps = {
  appointmentId: string;
  customerEmail: string | null;
  currentVehicleId: string | null;
};

export function InvoiceVehicleSection({
  appointmentId,
  customerEmail,
  currentVehicleId,
}: InvoiceVehicleSectionProps) {
  const queryClient = useQueryClient();

  /* --------- Load user garage from vehicles (by owner_email) --------- */
  const {
    data: userGarage = [],
    isLoading: loadingGarage,
  } = useQuery({
    queryKey: ["user-garage-for-invoice", customerEmail],
    enabled: !!customerEmail,
    queryFn: async () => {
      if (!customerEmail) return [] as Vehicle[];

      const normalizedEmail = customerEmail.trim();
      console.log(
        "[InvoiceVehicleSection] Querying vehicles for email:",
        normalizedEmail
      );

      const { data, error } = await supabaseClient
        .from("vehicles")
        .select(
          "id, owner_email, year, make, model, color, vin, license_plate, insurance_carrier, is_default"
        )
        .ilike("owner_email", normalizedEmail);

      if (error) {
        console.error("Error loading user garage", error);
        return [] as Vehicle[];
      }

      console.log(
        "[InvoiceVehicleSection] Vehicles found:",
        (data ?? []).length
      );

      return (data ?? []) as Vehicle[];
    },
  });

  /* --------- Selected vehicle (for dropdown binding) --------- */
  const [selectedVehicleId, setSelectedVehicleId] =
    React.useState<string>("");

  React.useEffect(() => {
    if (currentVehicleId) {
      setSelectedVehicleId(currentVehicleId);
    } else {
      setSelectedVehicleId("");
    }
  }, [currentVehicleId]);

  /* --------- Mutation: update appointment.vehicle_id --------- */
  const updateVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      if (!appointmentId) return;
      await supabaseClient
        .from("appointments")
        .update({ vehicle_id: vehicleId || null })
        .eq("id", appointmentId);
    },
    onSuccess: () => {
      if (!appointmentId) return;
      queryClient.invalidateQueries({
        queryKey: ["appointment-for-invoice", appointmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tech-invoice", appointmentId],
      });
    },
  });

  const selectedVehicle = selectedVehicleId
    ? userGarage.find((x) => x.id === selectedVehicleId) ?? null
    : null;

  return (
    <Card className="border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,221,128,0.08),rgba(58,58,63,0.22)_20%,rgba(30,30,34,0.58)_100%)] backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)] print:bg-white print:border-slate-200 print:shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-50 print:text-slate-900">
          <Car className="w-4 h-4 text-amber-300" />
          Vehicle
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm text-amber-50 print:text-slate-800">
        <div className="rounded-lg border border-white/10 bg-[rgba(42,42,46,0.44)] px-3 py-2 text-[11px] text-amber-100/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] print:border-slate-200 print:bg-slate-50 print:text-slate-600">
          Garage for:{" "}
          <span className="font-mono text-amber-50 print:text-slate-900">
            {customerEmail ? customerEmail.trim() : "no email"}
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-amber-100/62 print:text-slate-500">
            Select Vehicle from Garage
          </label>

          <select
            disabled={loadingGarage || userGarage.length === 0}
            value={selectedVehicleId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedVehicleId(newId);
              updateVehicleMutation.mutate(newId);
            }}
            className="w-full rounded-xl border border-white/10 bg-[rgba(34,34,38,0.58)] px-3 py-2 text-sm text-amber-50 outline-none backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] disabled:cursor-not-allowed disabled:opacity-60 print:border-slate-200 print:bg-white print:text-slate-900"
          >
            <option value="">
              {loadingGarage
                ? "Loading vehicles…"
                : userGarage.length === 0
                ? "No vehicles on file"
                : "Select a vehicle…"}
            </option>
            {userGarage.map((v) => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model}
                {v.license_plate ? ` • ${v.license_plate}` : ""}
              </option>
            ))}
          </select>
        </div>

        {updateVehicleMutation.isError && (
          <p className="text-xs text-red-400">
            Failed to update vehicle on appointment.
          </p>
        )}

        {updateVehicleMutation.isSuccess && (
          <p className="text-xs text-emerald-300">
            Vehicle updated.
          </p>
        )}

        {selectedVehicle && (
          <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-[rgba(42,42,46,0.42)] p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] print:border-slate-200 print:bg-white">
            <p className="flex items-center gap-2 text-lg font-bold text-amber-50 print:text-slate-900">
              {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
            </p>

            <div className="space-y-1 text-sm">
              {selectedVehicle.color && (
                <p>
                  <span className="text-amber-100/62 print:text-slate-500">Color:</span>{" "}
                  <span className="text-amber-50 print:text-slate-900">{selectedVehicle.color}</span>
                </p>
              )}

              {selectedVehicle.vin && (
                <p className="break-all">
                  <span className="text-amber-100/62 print:text-slate-500">VIN:</span>{" "}
                  <span className="text-amber-50 print:text-slate-900">{selectedVehicle.vin}</span>
                </p>
              )}

              {selectedVehicle.license_plate && (
                <p>
                  <span className="text-amber-100/62 print:text-slate-500">Plate:</span>{" "}
                  <span className="text-amber-50 print:text-slate-900">{selectedVehicle.license_plate}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {typeof selectedVehicle.is_default === "boolean" && (
                <span className="inline-flex items-center rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100 print:border-slate-300 print:bg-slate-100 print:text-slate-700">
                  {selectedVehicle.is_default ? "Default vehicle" : "Non-default vehicle"}
                </span>
              )}

              {selectedVehicle.insurance_carrier && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-[rgba(34,34,38,0.42)] px-2.5 py-1 text-[11px] text-amber-100/80 print:border-slate-300 print:bg-slate-100 print:text-slate-700">
                  Insurance: {selectedVehicle.insurance_carrier}
                </span>
              )}
            </div>
          </div>
        )}

        {!loadingGarage && userGarage.length === 0 && !selectedVehicleId && (
          <div className="rounded-lg border border-white/10 bg-[rgba(34,34,38,0.38)] px-3 py-2 text-xs text-amber-50/70 backdrop-blur-xl print:border-slate-200 print:bg-slate-50 print:text-slate-700">
            No vehicles found for this customer email in garage.
          </div>
        )}
      </CardContent>
    </Card>
  );
}