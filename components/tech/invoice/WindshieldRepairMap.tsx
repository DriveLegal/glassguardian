// components/tech/invoice/WindshieldRepairMap.tsx
"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseClient } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

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
  const col = Math.floor(cx * 3); // 0..2
  const row = Math.floor(cy * 3); // 0..2
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
      <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow-lg p-4">
        <h3 className="text-lg font-semibold mb-2">
          Marker — {Math.round(marker.x * 100)}%, {Math.round(marker.y * 100)}%
        </h3>

        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Mode:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("create")}
                className={`px-3 py-1 rounded ${
                  mode === "create"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Create new repair
              </button>
              <button
                onClick={() => setMode("attach")}
                className={`px-3 py-1 rounded ${
                  mode === "attach"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                Attach to existing
              </button>
            </div>
          </div>

          {mode === "attach" && (
            <div>
              <label className="block text-sm font-medium">
                Select existing repair
              </label>
              <select
                className="w-full mt-1 p-2 border rounded"
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
            <label className="block text-sm font-medium">Damage Type</label>
            <input
              className="w-full mt-1 p-2 border rounded"
              value={damageType ?? ""}
              onChange={(e) => setDamageType(e.target.value || null)}
              placeholder="e.g. bullseye, star, crack"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Crack Length (inches)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="w-full mt-1 p-2 border rounded"
              value={crackLen ?? ""}
              onChange={(e) =>
                setCrackLen(e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="e.g. 2.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Notes</label>
            <textarea
              className="w-full mt-1 p-2 border rounded"
              rows={3}
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value || null)}
            />
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <button onClick={onClose} className="px-3 py-2 rounded border">
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
                className="px-3 py-2 rounded bg-emerald-500 text-white"
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
                className="px-3 py-2 rounded bg-sky-600 text-white disabled:opacity-60"
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

  // Saved markers from JSON
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

  /**
   * ✅ BEST FIX:
   * 1) Ensure React keys are unique by using a stable, deterministic renderKey.
   * 2) Prevent “temp markers” from duplicating existing saved marker ids.
   * This removes the warning and avoids weird UI identity issues.
   */
  const savedIds = React.useMemo(() => {
    const s = new Set<string>();
    for (const m of savedMarkers) s.add(String(m.id));
    return s;
  }, [savedMarkers]);

  const combinedMarkers = React.useMemo(() => {
    // filter temp markers whose id collides with saved marker ids
    const safeTemp = tempMarkers.filter((t) => !savedIds.has(String(t.id)));

    // IMPORTANT: renderKey must be unique even if marker.id duplicates in data
    // We keep the original marker.id untouched for editing/upsert logic.
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

      // clear temp markers that match saved ids (best-effort cleanup)
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

    // If (somehow) a generated id collides, suffix it so it becomes unique.
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
  // USER VIEW (readOnly): ONLY windshield + saved markers (X)
  // ============================================================
  if (isReadOnly) {
    return (
      <div
        ref={mapRef}
        className="relative rounded-2xl overflow-hidden border border-cyan-200/60 bg-gradient-to-b from-slate-900/70 to-slate-950 shadow-[0_16px_40px_rgba(8,47,73,0.9)]"
        style={{ aspectRatio: "3 / 1" }}
      >
        {/* 9-grid background (NO LABELS) */}
        <div className="grid grid-cols-3 h-full">
          {QUADRANTS.map((q, idx) => {
            const active = activeQuadrants.has(q.id);
            return (
              <div
                key={q.id}
                className={[
                  "relative border-slate-700/80 select-none",
                  idx < 6 ? "border-b" : "",
                  idx % 3 !== 2 ? "border-r" : "",
                  active ? "bg-emerald-400/14" : "",
                ].join(" ")}
              />
            );
          })}
        </div>

        {/* glass arc overlay */}
        <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 w-[82%] h-6 rounded-full border border-cyan-200/80 border-b-0 bg-gradient-to-b from-cyan-200/60 via-sky-300/20 to-transparent opacity-80" />

        {/* SAVED markers ONLY (no buttons) */}
        {savedMarkers.map((m, i) => {
          const left = `${m.x * 100}%`;
          const top = `${m.y * 100}%`;
          // renderKey avoids collisions if savedMarkers has duplicate ids
          const renderKey = `ro:${String(m.id)}:${m.sourceIndex}:${i}`;
          return (
            <div
              key={renderKey}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center"
              style={{ left, top }}
            >
              <span className="text-2xl text-emerald-300 drop-shadow-[0_0_10px_rgba(16,185,129,0.9)] pointer-events-none select-none">
                ✕
              </span>
              <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-300/80 -z-10" />
            </div>
          );
        })}
      </div>
    );
  }

  // ============================================================
  // TECH VIEW (editable): ORIGINAL UI
  // ============================================================
  return (
    <Card className="border border-slate-700/70 bg-slate-900/70 backdrop-blur-xl shadow-[0_22px_70px_rgba(15,23,42,0.9)] print:bg-white print:border-slate-200 print:shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-50 print:text-slate-900">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Windshield Repair Map &amp; Details
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="max-w-md mx-auto">
          <p className="text-xs text-slate-400 mb-2 text-center print:text-slate-600">
            Click anywhere on the windshield diagram to drop a marker (X)
            specifying the exact spot repaired. Toggle "Mark Damage" and click
            to add. Use the modal to attach to an existing repair or create a
            new repair with metadata.
          </p>

          <div className="flex items-center justify-center gap-2 mb-3 print:hidden">
            <Button
              onClick={() => setIsMarking((s) => !s)}
              className={[
                "text-sm px-3 py-1",
                isMarking
                  ? "bg-emerald-500/90 text-slate-900"
                  : "bg-slate-800 text-slate-100",
              ].join(" ")}
            >
              {isMarking ? "Marking: Click map to add" : "Mark Damage"}
            </Button>

            <Button
              variant="outline"
              onClick={handleClearTemp}
              disabled={tempMarkers.length === 0}
              className="text-sm px-3 py-1"
            >
              Clear Unsaved
            </Button>

            <div className="ml-3 text-xs text-slate-300">
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
              "relative rounded-2xl overflow-hidden border border-cyan-200/60 bg-gradient-to-b from-slate-900/70 to-slate-950 shadow-[0_16px_40px_rgba(8,47,73,0.9)]",
              isMarking ? "cursor-crosshair ring-2 ring-emerald-400/30" : "",
            ].join(" ")}
            style={{ aspectRatio: "3 / 1" }}
          >
            {/* grid with labels (tech mode) */}
            <div className="grid grid-cols-3 h-full">
              {QUADRANTS.map((q, idx) => {
                const active = activeQuadrants.has(q.id);
                return (
                  <div
                    key={q.id}
                    className={[
                      "relative flex items-center justify-center text-[11px] font-medium border-slate-700/80",
                      idx < 6 ? "border-b" : "",
                      idx % 3 !== 2 ? "border-r" : "",
                      active
                        ? "bg-emerald-400/20 text-emerald-100"
                        : "text-slate-400",
                    ].join(" ")}
                  >
                    <span className="relative z-10 opacity-90">{q.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 w-[82%] h-6 rounded-full border border-cyan-200/80 border-b-0 bg-gradient-to-b from-cyan-200/60 via-sky-300/20 to-transparent opacity-80" />

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
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center"
                    style={{ left, top }}
                  >
                    <span className="text-2xl text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.85)] pointer-events-none select-none">
                      ✕
                    </span>
                    <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-300/80 -z-10" />
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
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center"
                    style={{ left, top }}
                  >
                    <span
                      className={[
                        "text-2xl font-black pointer-events-none select-none",
                        isSelected
                          ? "text-amber-300 drop-shadow-[0_0_12px_rgba(250,204,21,0.85)]"
                          : "text-emerald-200 drop-shadow-[0_0_8px_rgba(16,185,129,0.85)]",
                      ].join(" ")}
                    >
                      ✕
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* details list (tech only) */}
        {invoice.windshield_repairs_json &&
        invoice.windshield_repairs_json.length > 0 ? (
          <div className="grid gap-3">
            {invoice.windshield_repairs_json.map((r: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-700/80 bg-slate-950/70 text-sm text-slate-100 shadow-md shadow-slate-950/60 print:bg-white print:border-slate-200 print:text-slate-800 print:shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {r.location && (
                    <Badge
                      variant="outline"
                      className="border-cyan-300/70 text-cyan-200 text-[10px]"
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
                      className="border-emerald-300/70 text-emerald-200 text-[10px]"
                    >
                      {String(r.quadrant).toUpperCase()}
                    </Badge>
                  )}
                  {r.damage_type && (
                    <Badge
                      variant="outline"
                      className="border-slate-500/80 text-slate-200 text-[10px]"
                    >
                      {String(r.damage_type).toUpperCase()}
                    </Badge>
                  )}
                </div>

                {r.notes && (
                  <p className="mt-2 text-xs md:text-sm">
                    <span className="font-semibold">Tech Notes:</span> {r.notes}
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
                    className="text-xs px-2 py-1"
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
                      className="text-xs px-2 py-1"
                    >
                      Remove Marker
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm text-center print:text-slate-700">
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