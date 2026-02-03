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
        // case-insensitive match on email (handles USER@ vs user@)
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
      // Refresh appointment + tech invoice so everything stays in sync
      queryClient.invalidateQueries({
        queryKey: ["appointment-for-invoice", appointmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tech-invoice", appointmentId],
      });
    },
  });

  return (
    <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.8)] print:bg-white print:border-slate-200 print:shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
          <Car className="w-4 h-4 text-cyan-300" />
          Vehicle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-100 print:text-slate-800">
        {/* Show which email we’re using, just for sanity */}
        <p className="text-[11px] text-slate-400">
          Garage for:{" "}
          <span className="font-mono">
            {customerEmail ? customerEmail.trim() : "no email"}
          </span>
        </p>

        <div className="space-y-1">
          <label className="text-xs text-slate-400">
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
            className="w-full bg-slate-950/60 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 outline-none"
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

        {/* Details for selected vehicle */}
        {selectedVehicleId &&
          (() => {
            const v = userGarage.find((x) => x.id === selectedVehicleId);
            if (!v) return null;
            return (
              <div className="space-y-1 mt-2">
                <p className="text-lg font-bold flex items-center gap-2 text-slate-50 print:text-slate-900">
                  {v.year} {v.make} {v.model}
                </p>
                {v.color && <p>Color: {v.color}</p>}
                {v.vin && <p className="break-all">VIN: {v.vin}</p>}
                {v.license_plate && <p>Plate: {v.license_plate}</p>}
                {typeof v.is_default === "boolean" && (
                  <p className="text-xs text-slate-400">
                    {v.is_default ? "Default vehicle" : "Non-default vehicle"}
                  </p>
                )}
                {v.insurance_carrier && (
                  <p className="text-xs text-slate-400">
                    Insurance: {v.insurance_carrier}
                  </p>
                )}
              </div>
            );
          })()}

        {!loadingGarage &&
          userGarage.length === 0 &&
          !selectedVehicleId && (
            <p className="text-slate-300 text-xs">
              No vehicles found for this customer email in garage.
            </p>
          )}
      </CardContent>
    </Card>
  );
}