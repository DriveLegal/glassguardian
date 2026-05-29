// components/tech/invoice/WindshieldRepairMap.tsx
"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ScanSearch } from "lucide-react";

/* 9-quadrant windshield grid mapping */
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

function getActiveQuadrantIds(repairs: any[] | null | undefined): Set<string> {
  const active = new Set<string>();
  if (!repairs) return active;

  for (const r of repairs) {
    const raw = (r?.quadrant ?? r?.location ?? "")
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (!raw) continue;

    for (const q of QUADRANTS) {
      if (raw.includes(q.id)) active.add(q.id);
    }
  }

  return active;
}

/* quadrant by normalized x/y (0..1) */
function quadrantFromXY(x: number, y: number) {
  const cx = Math.min(0.9999, Math.max(0, x));
  const cy = Math.min(0.9999, Math.max(0, y));
  const col = Math.floor(cx * 3);
  const row = Math.floor(cy * 3);
  const idx = row * 3 + col;
  return QUADRANTS[idx] || QUADRANTS[4];
}

/* ---------- Small inline Modal to edit marker metadata (TECH ONLY UI) ---------- */
function MarkerModal({
  open,
  onClose,
  marker,
  existingRepairs,
  initialRepairIndex,
  onSaveAsNew,
  onUpdateExisting,
}: {
  open: boolean;
  onClose: () => void;
  marker: { id: string; x: number; y: number } | null;
  existingRepairs: any[];
  initialRepairIndex?: number | null;
  onSaveAsNew: (payload: {
    id: string;
    x: number;
    y: number;
    damage_type?: string | null;
    crack_length_inches?: number | null;
    notes?: string | null;
  }) => void;
  onUpdateExisting: (payload: {
    index: number;
    id?: string;
    x?: number;
    y?: number;
    damage_type?: string | null;
    crack_length_inches?: number | null;
    notes?: string | null;
  }) => void;
}) {
  const [mode, setMode] = React.useState<"create" | "attach">("create");
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(
    initialRepairIndex ?? null
  );
  const [damageType, setDamageType] = React.useState<string | null>(null);
  const [crackLen, setCrackLen] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMode(initialRepairIndex != null ? "attach" : "create");
    setSelectedIndex(initialRepairIndex ?? null);
    setDamageType(null);
    setCrackLen(null);
    setNotes(null);
  }, [open, initialRepairIndex]);

  if (!open || !marker) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(255,221,128,0.10),rgba(42,42,46,0.94)_18%,rgba(28,28,31,0.98)_100%)] p-4 text-amber-50 shadow-[0_28px_80px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
        <h3 className="mb-3 text-lg font-semibold">
          Marker — {Math.round(marker.x * 100)}%, {Math.round(marker.y * 100)}%
        </h3>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-amber-100/80">Mode:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("create")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  mode === "create"
                    ? "bg-amber-300 text-[#1a1208]"
                    : "bg-[rgba(44,44,47,0.56)] text-amber-50"
                }`}
              >
                Create new repair
              </button>
              <button
                onClick={() => setMode("attach")}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  mode === "attach"
                    ? "bg-amber-300 text-[#1a1208]"
                    : "bg-[rgba(44,44,47,0.56)] text-amber-50"
                }`}
              >
                Attach to existing
              </button>
            </div>
          </div>

          {mode === "attach" && (
            <div>
              <label className="block text-sm font-medium text-amber-100/78">
                Select existing repair
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-[rgba(28,28,31,0.66)] p-2 text-amber-50 outline-none"
                value={selectedIndex ?? ""}
                onChange={(e) =>
                  setSelectedIndex(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
              >
                <option value="">Choose repair...</option>
                {existingRepairs.map((r, idx) => (
                  <option key={idx} value={idx}>
                    {r.location
                      ? `${String(r.location).replace(/_/g, " ")} (${idx + 1})`
                      : `Repair ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-amber-100/78">
              Damage Type
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-[rgba(28,28,31,0.66)] p-2 text-amber-50 outline-none"
              value={damageType ?? ""}
              onChange={(e) => setDamageType(e.target.value || null)}
              placeholder="e.g. bullseye, star, crack"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-100/78">
              Crack Length (inches)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="mt-1 w-full rounded-xl border border-white/10 bg-[rgba(28,28,31,0.66)] p-2 text-amber-50 outline-none"
              value={crackLen ?? ""}
              onChange={(e) =>
                setCrackLen(e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="e.g. 2.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-100/78">
              Notes
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-[rgba(28,28,31,0.66)] p-2 text-amber-50 outline-none"
              rows={3}
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value || null)}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-[rgba(44,44,47,0.56)] px-3 py-2 text-amber-50"
            >
              Cancel
            </button>
            {mode === "create" ? (
              <button
                onClick={() =>
                  onSaveAsNew({
                    id: marker.id,
                    x: marker.x,
                    y: marker.y,
                    damage_type: damageType,
                    crack_length_inches: crackLen,
                    notes,
                  })
                }
                className="rounded-lg bg-gradient-to-r from-amber-300 to-yellow-400 px-3 py-2 font-semibold text-[#1a1208]"
              >
                Save as new repair
              </button>
            ) : (
              <button
                disabled={selectedIndex == null}
                onClick={() =>
                  selectedIndex != null &&
                  onUpdateExisting({
                    index: selectedIndex,
                    id: marker.id,
                    x: marker.x,
                    y: marker.y,
                    damage_type: damageType,
                    crack_length_inches: crackLen,
                    notes,
                  })
                }
                className="rounded-lg bg-gradient-to-r from-amber-300 to-yellow-400 px-3 py-2 font-semibold text-[#1a1208] disabled:opacity-60"
              >
                Update selected repair
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export type WindshieldRepairMapProps = {
  invoice: {
    id: string;
    windshield_repairs_json: any[] | null;
  };
  readOnly?: boolean;
};

export const WindshieldRepairMap: React.FC<WindshieldRepairMapProps> = ({
  invoice,
  readOnly,
}) => {
  const isReadOnly = !!readOnly;
  const queryClient = useQueryClient();
  const mapRef = React.useRef<HTMLDivElement | null>(null);

  const [isMarking, setIsMarking] = React.useState(false);
  const [tempMarkers, setTempMarkers] = React.useState<
    { id: string; x: number; y: number }[]
  >([]);
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | null>(
    null
  );

  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMarker, setModalMarker] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [modalInitialAttachIndex, setModalInitialAttachIndex] =
    React.useState<number | null>(null);

  const activeQuadrants = React.useMemo(
    () => getActiveQuadrantIds(invoice.windshield_repairs_json ?? []),
    [invoice.windshield_repairs_json]
  );

  const savedMarkers = React.useMemo(() => {
    const arr = invoice.windshield_repairs_json ?? [];
    const markers: { id: string; x: number; y: number; sourceIndex: number }[] =
      [];

    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      if (
        entry &&
        entry.marker &&
        typeof entry.marker.x === "number" &&
        typeof entry.marker.y === "number"
      ) {
        const id = entry.id ?? `saved-${i}`;
        markers.push({
          id,
          x: entry.marker.x,
          y: entry.marker.y,
          sourceIndex: i,
        });
      }
    }
    return markers;
  }, [invoice.windshield_repairs_json]);

  const savedIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const m of savedMarkers) s.add(String(m.id));
    return s;
  }, [savedMarkers]);

  const combinedMarkers = React.useMemo(() => {
    const safeTemp = tempMarkers.filter((t) => !savedIds.has(String(t.id)));

    const saved = savedMarkers.map((m) => ({
      ...m,
      saved: true as const,
      renderKey: `saved:${String(m.id)}:${m.sourceIndex}`,
    }));

    const temp = safeTemp.map((m, idx) => ({
      ...m,
      saved: false as const,
      renderKey: `temp:${String(m.id)}:${idx}`,
    }));

    return [...saved, ...temp];
  }, [savedMarkers, tempMarkers, savedIds]);

  const upsertRepairMutation = useMutation({
    mutationFn: async (payload: {
      mode: "append" | "update";
      marker: { id: string; x: number; y: number };
      metadata?: {
        damage_type?: string | null;
        crack_length_inches?: number | null;
        notes?: string | null;
      };
      targetIndex?: number;
    }) => {
      if (isReadOnly) throw new Error("Read-only mode: cannot modify repairs");

      const invoiceId = invoice.id;

      const { data: latestRow, error: fetchErr } = await supabaseClient
        .from("tech_invoices")
        .select("windshield_repairs_json")
        .eq("id", invoiceId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const exist = Array.isArray(latestRow?.windshield_repairs_json)
        ? latestRow!.windshield_repairs_json.slice()
        : [];

      if (payload.mode === "append") {
        const q = quadrantFromXY(payload.marker.x, payload.marker.y);
        const newEntry: any = {
          id: payload.marker.id,
          marker: {
            x: Number(payload.marker.x.toFixed(6)),
            y: Number(payload.marker.y.toFixed(6)),
          },
          quadrant: q.id,
          location: q.label,
          damage_type: payload.metadata?.damage_type ?? null,
          crack_length_inches: payload.metadata?.crack_length_inches ?? null,
          notes: payload.metadata?.notes ?? "Marked location (tech)",
          created_at: new Date().toISOString(),
        };

        const updated = [...exist, newEntry];
        const { data, error } = await supabaseClient
          .from("tech_invoices")
          .update({ windshield_repairs_json: updated })
          .eq("id", invoiceId)
          .select("id,windshield_repairs_json")
          .maybeSingle();

        if (error) throw error;
        return data;
      } else {
        const idx = payload.targetIndex!;
        if (idx < 0 || idx >= exist.length)
          throw new Error("Invalid target index");

        const entry = { ...(exist[idx] || {}) };
        entry.marker = {
          x: Number(payload.marker.x.toFixed(6)),
          y: Number(payload.marker.y.toFixed(6)),
        };

        const q = quadrantFromXY(payload.marker.x, payload.marker.y);
        entry.quadrant = q.id;
        entry.location = q.label;

        if (payload.metadata) {
          if ("damage_type" in payload.metadata)
            entry.damage_type = payload.metadata.damage_type;
          if ("crack_length_inches" in payload.metadata)
            entry.crack_length_inches = payload.metadata.crack_length_inches;
          if ("notes" in payload.metadata)
            entry.notes = payload.metadata.notes ?? entry.notes;
        }

        entry.updated_at = new Date().toISOString();
        const updated = exist.slice();
        updated[idx] = entry;

        const { data, error } = await supabaseClient
          .from("tech_invoices")
          .update({ windshield_repairs_json: updated })
          .eq("id", invoiceId)
          .select("id,windshield_repairs_json")
          .maybeSingle();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-invoice", invoice.id] });
      setModalOpen(false);
      setModalMarker(null);
      setModalInitialAttachIndex(null);
      setTempMarkers((prev) => prev.filter((t) => !savedIds.has(String(t.id))));
    },
  });

  const removeRepairMutation = useMutation({
    mutationFn: async (index: number) => {
      if (isReadOnly) throw new Error("Read-only mode: cannot remove repairs");

      const invoiceId = invoice.id;

      const { data: latestRow, error: fetchErr } = await supabaseClient
        .from("tech_invoices")
        .select("windshield_repairs_json")
        .eq("id", invoiceId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const exist = Array.isArray(latestRow?.windshield_repairs_json)
        ? latestRow!.windshield_repairs_json.slice()
        : [];

      const updated = exist.filter((_: any, idx: number) => idx !== index);

      const { data, error } = await supabaseClient
        .from("tech_invoices")
        .update({ windshield_repairs_json: updated })
        .eq("id", invoiceId)
        .select("id,windshield_repairs_json")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-invoice", invoice.id] });
    },
  });

  function handleMapClick(e: React.MouseEvent) {
    if (isReadOnly) return;
    if (!isMarking) return;
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    const x = Math.min(0.999999, Math.max(0, cx));
    const y = Math.min(0.999999, Math.max(0, cy));

    const id =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `m-${Date.now()}`;

    const finalId = savedIds.has(String(id)) ? `${id}-${Date.now()}` : id;

    const marker = { id: finalId, x, y };
    setTempMarkers((s) => [...s, marker]);
    setSelectedMarkerId(finalId);

    setModalInitialAttachIndex(null);
    setModalMarker(marker);
    setModalOpen(true);
  }

  function handleMarkerClick(
    marker: { id: string; saved?: boolean; sourceIndex?: number },
    e?: React.MouseEvent
  ) {
    if (isReadOnly) return;
    e?.stopPropagation();

    if (marker.saved && typeof marker.sourceIndex === "number") {
      const idx = marker.sourceIndex;
      const entry = invoice.windshield_repairs_json?.[idx];
      const markerObj =
        entry?.marker &&
        typeof entry.marker.x === "number" &&
        typeof entry.marker.y === "number"
          ? { id: entry.id ?? `saved-${idx}`, x: entry.marker.x, y: entry.marker.y }
          : { id: entry?.id ?? `saved-${idx}`, x: 0.5, y: 0.5 };

      setModalMarker(markerObj);
      setModalInitialAttachIndex(idx);
      setModalOpen(true);
      return;
    }
  }

  function handleSaveAsNew(payload: {
    id: string;
    x: number;
    y: number;
    damage_type?: string | null;
    crack_length_inches?: number | null;
    notes?: string | null;
  }) {
    if (isReadOnly) return;
    upsertRepairMutation.mutate({
      mode: "append",
      marker: { id: payload.id, x: payload.x, y: payload.y },
      metadata: {
        damage_type: payload.damage_type ?? null,
        crack_length_inches: payload.crack_length_inches ?? null,
        notes: payload.notes ?? null,
      },
    });
  }

  function handleUpdateExisting(payload: {
    index: number;
    id?: string;
    x?: number;
    y?: number;
    damage_type?: string | null;
    crack_length_inches?: number | null;
    notes?: string | null;
  }) {
    if (isReadOnly) return;
    upsertRepairMutation.mutate({
      mode: "update",
      marker: {
        id: payload.id ?? `u-${Date.now()}`,
        x: payload.x ?? 0.5,
        y: payload.y ?? 0.5,
      },
      metadata: {
        damage_type: payload.damage_type ?? null,
        crack_length_inches: payload.crack_length_inches ?? null,
        notes: payload.notes ?? null,
      },
      targetIndex: payload.index,
    });
  }

  function handleClearTemp() {
    if (isReadOnly) return;
    setTempMarkers([]);
    setSelectedMarkerId(null);
  }

  // ============================================================
  // USER / RECEIPT VIEW
  // ============================================================
  if (isReadOnly) {
    return (
      <Card className="border border-amber-300/22 bg-[linear-gradient(180deg,rgba(255,224,130,0.08),rgba(58,58,63,0.20)_22%,rgba(30,30,34,0.54)_100%)] backdrop-blur-2xl shadow-[0_24px_70px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.06)] print:bg-white print:border-slate-200 print:shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-50 print:text-slate-900">
            <ScanSearch className="h-5 w-5 text-amber-300" />
            Windshield Repair Map
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="mx-auto max-w-3xl">
            <div
              ref={mapRef}
              className="relative overflow-hidden rounded-2xl border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,224,130,0.08),rgba(42,42,46,0.24)_20%,rgba(24,24,27,0.76)_100%)] shadow-[0_16px_40px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.05)]"
              style={{ aspectRatio: "3 / 1" }}
            >
              {/* 9-grid background */}
              <div className="grid h-full grid-cols-3">
                {QUADRANTS.map((q, idx) => {
                  const active = activeQuadrants.has(q.id);
                  return (
                    <div
                      key={q.id}
                      className={[
                        "relative border-white/8 select-none",
                        idx < 6 ? "border-b" : "",
                        idx % 3 !== 2 ? "border-r" : "",
                        active ? "bg-amber-400/10" : "",
                      ].join(" ")}
                    />
                  );
                })}
              </div>

              {/* glass arc overlay */}
              <div className="pointer-events-none absolute -top-4 left-1/2 h-6 w-[82%] -translate-x-1/2 rounded-full border border-amber-200/45 border-b-0 bg-gradient-to-b from-amber-200/35 via-amber-300/10 to-transparent opacity-90" />

              {/* saved markers only */}
              {savedMarkers.map((m, i) => {
                const left = `${m.x * 100}%`;
                const top = `${m.y * 100}%`;
                const renderKey = `ro:${String(m.id)}:${m.sourceIndex}:${i}`;
                return (
                  <div
                    key={renderKey}
                    className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                    style={{ left, top }}
                  >
                    <span className="pointer-events-none select-none text-2xl text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.85)]">
                      ✕
                    </span>
                    <span className="absolute -z-10 h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                  </div>
                );
              })}
            </div>
          </div>

          {invoice.windshield_repairs_json &&
          invoice.windshield_repairs_json.length > 0 ? (
            <div className="grid gap-3">
              {invoice.windshield_repairs_json.map((r: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-[rgba(42,42,46,0.42)] p-4 text-sm text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] print:border-slate-200 print:bg-white print:text-slate-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {r.location && (
                      <Badge
                        variant="outline"
                        className="border-amber-300/35 text-amber-100 text-[10px] print:border-slate-300 print:text-slate-700"
                      >
                        {String(r.location)
                          .toString()
                          .replace(/_/g, " ")
                          .toUpperCase()}
                      </Badge>
                    )}
                    {r.quadrant && (
                      <Badge
                        variant="outline"
                        className="border-amber-300/25 text-amber-200 text-[10px] print:border-slate-300 print:text-slate-700"
                      >
                        {String(r.quadrant).toUpperCase()}
                      </Badge>
                    )}
                    {r.damage_type && (
                      <Badge
                        variant="outline"
                        className="border-white/12 text-amber-50/80 text-[10px] print:border-slate-300 print:text-slate-700"
                      >
                        {String(r.damage_type).toUpperCase()}
                      </Badge>
                    )}
                    {r.crack_length_inches != null && (
                      <Badge
                        variant="outline"
                        className="border-white/12 text-amber-50/80 text-[10px] print:border-slate-300 print:text-slate-700"
                      >
                        {r.crack_length_inches}" CRACK
                      </Badge>
                    )}
                  </div>

                  {r.notes && (
                    <p className="mt-2 text-xs md:text-sm">
                      <span className="font-semibold text-amber-100 print:text-slate-900">
                        Repair Notes:
                      </span>{" "}
                      {r.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-amber-50/68 print:text-slate-700">
              No specific damage locations recorded on this invoice.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  // TECH VIEW (editable)
  // ============================================================
  return (
    <Card className="border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,221,128,0.08),rgba(58,58,63,0.22)_20%,rgba(30,30,34,0.58)_100%)] backdrop-blur-2xl shadow-[0_28px_80px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)] print:bg-white print:border-slate-200 print:shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-50 print:text-slate-900">
          <ShieldCheck className="h-5 w-5 text-amber-300" />
          Windshield Repair Map &amp; Details
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="mx-auto max-w-md">
          <p className="mb-2 text-center text-xs text-amber-50/62 print:text-slate-600">
            Click anywhere on the windshield diagram to drop a marker (X)
            specifying the exact spot repaired. Toggle "Mark Damage" and click
            to add. Use the modal to attach to an existing repair or create a
            new repair with metadata.
          </p>

          <div className="mb-3 flex items-center justify-center gap-2 print:hidden">
            <Button
              onClick={() => setIsMarking((s) => !s)}
              className={[
                "px-3 py-1 text-sm",
                isMarking
                  ? "bg-gradient-to-r from-amber-300 to-yellow-400 text-[#1a1208]"
                  : "bg-[rgba(44,44,47,0.56)] text-amber-50 hover:bg-[rgba(58,58,63,0.62)]",
              ].join(" ")}
            >
              {isMarking ? "Marking: Click map to add" : "Mark Damage"}
            </Button>

            <Button
              variant="outline"
              onClick={handleClearTemp}
              disabled={tempMarkers.length === 0}
              className="border-white/10 bg-[rgba(44,44,47,0.50)] text-amber-50 hover:bg-[rgba(58,58,63,0.60)] text-sm px-3 py-1"
            >
              Clear Unsaved
            </Button>

            <div className="ml-3 text-xs text-amber-50/72">
              {upsertRepairMutation.isPending && <span>Saving…</span>}
            </div>
          </div>

          <div
            ref={mapRef}
            onClick={handleMapClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "m" || e.key === "M") setIsMarking((s) => !s);
            }}
            className={[
              "relative overflow-hidden rounded-2xl border border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,224,130,0.08),rgba(42,42,46,0.24)_20%,rgba(24,24,27,0.76)_100%)] shadow-[0_16px_40px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.05)]",
              isMarking ? "cursor-crosshair ring-2 ring-amber-300/30" : "",
            ].join(" ")}
            style={{ aspectRatio: "3 / 1" }}
          >
            {/* tech grid with labels */}
            <div className="grid h-full grid-cols-3">
              {QUADRANTS.map((q, idx) => {
                const active = activeQuadrants.has(q.id);
                return (
                  <div
                    key={q.id}
                    className={[
                      "relative flex items-center justify-center border-white/8 text-[11px] font-medium",
                      idx < 6 ? "border-b" : "",
                      idx % 3 !== 2 ? "border-r" : "",
                      active
                        ? "bg-amber-400/14 text-amber-100"
                        : "text-amber-50/52",
                    ].join(" ")}
                  >
                    <span className="relative z-10 opacity-90">{q.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="pointer-events-none absolute -top-4 left-1/2 h-6 w-[82%] -translate-x-1/2 rounded-full border border-amber-200/45 border-b-0 bg-gradient-to-b from-amber-200/35 via-amber-300/10 to-transparent opacity-90" />

            {/* saved markers */}
            {combinedMarkers
              .filter((m: any) => m.saved)
              .map((m: any) => {
                const left = `${m.x * 100}%`;
                const top = `${m.y * 100}%`;
                return (
                  <button
                    key={m.renderKey}
                    type="button"
                    onClick={(e) =>
                      handleMarkerClick(
                        { id: m.id, saved: true, sourceIndex: m.sourceIndex },
                        e
                      )
                    }
                    title="Saved marker — click to edit"
                    className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                    style={{ left, top }}
                  >
                    <span className="pointer-events-none select-none text-2xl text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.85)]">
                      ✕
                    </span>
                    <span className="absolute -z-10 h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                  </button>
                );
              })}

            {/* temp markers */}
            {combinedMarkers
              .filter((m: any) => !m.saved)
              .map((m: any) => {
                const left = `${m.x * 100}%`;
                const top = `${m.y * 100}%`;
                const isSelected = selectedMarkerId === m.id;
                return (
                  <button
                    key={m.renderKey}
                    type="button"
                    onClick={(e) =>
                      handleMarkerClick({ id: m.id, saved: false }, e)
                    }
                    title="Temp marker — click to edit"
                    className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                    style={{ left, top }}
                  >
                    <span
                      className={[
                        "pointer-events-none select-none text-2xl font-black",
                        isSelected
                          ? "text-yellow-200 drop-shadow-[0_0_12px_rgba(250,204,21,0.85)]"
                          : "text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]",
                      ].join(" ")}
                    >
                      ✕
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* details list */}
        {invoice.windshield_repairs_json &&
        invoice.windshield_repairs_json.length > 0 ? (
          <div className="grid gap-3">
            {invoice.windshield_repairs_json.map((r: any, idx: number) => (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-[rgba(42,42,46,0.42)] p-4 text-sm text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] print:border-slate-200 print:bg-white print:text-slate-800"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {r.location && (
                    <Badge
                      variant="outline"
                      className="border-amber-300/35 text-amber-100 text-[10px] print:border-slate-300 print:text-slate-700"
                    >
                      {String(r.location)
                        .toString()
                        .replace(/_/g, " ")
                        .toUpperCase()}
                    </Badge>
                  )}
                  {r.quadrant && (
                    <Badge
                      variant="outline"
                      className="border-amber-300/25 text-amber-200 text-[10px] print:border-slate-300 print:text-slate-700"
                    >
                      {String(r.quadrant).toUpperCase()}
                    </Badge>
                  )}
                  {r.damage_type && (
                    <Badge
                      variant="outline"
                      className="border-white/12 text-amber-50/80 text-[10px] print:border-slate-300 print:text-slate-700"
                    >
                      {String(r.damage_type).toUpperCase()}
                    </Badge>
                  )}
                </div>

                {r.notes && (
                  <p className="mt-2 text-xs md:text-sm">
                    <span className="font-semibold text-amber-100 print:text-slate-900">
                      Tech Notes:
                    </span>{" "}
                    {r.notes}
                  </p>
                )}

                <div className="mt-3 flex gap-2 print:hidden">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const entryMarker =
                        r?.marker &&
                        typeof r.marker.x === "number" &&
                        typeof r.marker.y === "number"
                          ? { id: r.id ?? `saved-${idx}`, x: r.marker.x, y: r.marker.y }
                          : { id: r.id ?? `saved-${idx}`, x: 0.5, y: 0.5 };

                      setModalMarker(entryMarker);
                      setModalInitialAttachIndex(idx);
                      setModalOpen(true);
                    }}
                    className="border-white/10 bg-[rgba(44,44,47,0.50)] px-2 py-1 text-xs text-amber-50 hover:bg-[rgba(58,58,63,0.60)]"
                  >
                    Edit
                  </Button>

                  {r.marker && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (
                          confirm(
                            "Remove this repair entry (including marker) from the invoice?"
                          )
                        ) {
                          removeRepairMutation.mutate(idx);
                        }
                      }}
                      className="border-white/10 bg-[rgba(44,44,47,0.50)] px-2 py-1 text-xs text-amber-50 hover:bg-[rgba(58,58,63,0.60)]"
                    >
                      Remove Marker
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-amber-50/68 print:text-slate-700">
            No specific damage locations recorded on this invoice.
          </p>
        )}
      </CardContent>

      <MarkerModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalMarker(null);
          setModalInitialAttachIndex(null);
        }}
        marker={modalMarker}
        existingRepairs={invoice.windshield_repairs_json ?? []}
        initialRepairIndex={modalInitialAttachIndex}
        onSaveAsNew={handleSaveAsNew}
        onUpdateExisting={handleUpdateExisting}
      />
    </Card>
  );
};