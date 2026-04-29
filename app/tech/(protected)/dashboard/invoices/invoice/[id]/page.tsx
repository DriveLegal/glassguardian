"use client";

// app/tech/(protected)/dashboard/invoices/invoice/[id]/page.tsx
//
// Tech invoice detail page — refactored.
//
// Key changes vs the original file:
//  • sendInvoiceMutation and markPaidMutation both delegate to the shared
//    submitInvoiceUpdate() helper; only the status value ("sent" vs "paid")
//    and the extra appointment update (markPaid only) differ between them.
//  • saveInsuranceFlatMutation has been removed — it was declared but never
//    called anywhere in the original file.
//  • Insurance validation and money computations are imported from
//    lib/invoiceHelpers.ts instead of being duplicated inline.
//  • The render tree is split into focused internal components
//    (InvoiceHeader, ServicesList, InsuranceSection, InvoiceSummary,
//    InvoiceActions) to keep the root component readable.

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import {
  validateInsurance,
  computeTotal,
  patchServicesForMode,
} from "@/lib/invoiceHelpers";
import type {
  InsuranceData,
  InvoiceStatus,
  ServiceItem,
  TechInvoice,
} from "@/lib/types/invoice";

// ─────────────────────────────────────────────────────────────────────────────
// Internal sub-components
// ─────────────────────────────────────────────────────────────────────────────

function InvoiceHeader({
  invoice,
  onForceEdit,
}: {
  invoice: TechInvoice;
  onForceEdit: () => void;
}) {
  const statusColor: Record<InvoiceStatus, string> = {
    draft: "#6b7280",
    sent: "#2563eb",
    paid: "#16a34a",
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Invoice #{invoice.id.slice(-8).toUpperCase()}
        </h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
          Customer: {invoice.customer_name}
          {invoice.customer_phone ? ` · ${invoice.customer_phone}` : ""}
          {invoice.customer_email ? ` · ${invoice.customer_email}` : ""}
        </p>
        <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 13 }}>
          Created {new Date(invoice.created_at).toLocaleDateString()}
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            background: statusColor[invoice.status] + "22",
            color: statusColor[invoice.status],
            border: `1px solid ${statusColor[invoice.status]}55`,
            textTransform: "capitalize",
          }}
        >
          {invoice.status}
        </span>
        {(invoice.status === "sent" || invoice.status === "paid") && (
          <button
            type="button"
            onClick={onForceEdit}
            style={{
              display: "block",
              marginTop: 8,
              marginLeft: "auto",
              fontSize: 12,
              color: "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function ServicesList({
  services,
  insuranceMode,
}: {
  services: ServiceItem[];
  insuranceMode: boolean;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Services
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ textAlign: "left", padding: "4px 8px" }}>Service</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>
              {insuranceMode ? "Insurance Price" : "Price"}
            </th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {services.map((item, i) => {
            const unitPrice = insuranceMode
              ? (item.insurance_price ?? item.price)
              : item.price;
            return (
              <tr key={item.id ?? i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "6px 8px" }}>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  {item.description && (
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {item.description}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "right", padding: "6px 8px" }}>
                  {item.quantity}
                </td>
                <td style={{ textAlign: "right", padding: "6px 8px" }}>
                  ${(unitPrice / 100).toFixed(2)}
                </td>
                <td style={{ textAlign: "right", padding: "6px 8px" }}>
                  ${((unitPrice * item.quantity) / 100).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function InsuranceSection({
  data,
  onChange,
}: {
  data: InsuranceData;
  onChange: (updated: InsuranceData) => void;
}) {
  function update(patch: Partial<InsuranceData>) {
    onChange({ ...data, ...patch });
  }

  return (
    <section
      style={{
        marginBottom: 24,
        padding: 16,
        border: "1px solid #bfdbfe",
        borderRadius: 8,
        background: "#eff6ff",
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Insurance Information
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            Insurance Company *
          </span>
          <input
            value={data.company}
            onChange={(e) => update({ company: e.target.value })}
            style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #93c5fd" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Policy Number *</span>
          <input
            value={data.policy_number}
            onChange={(e) => update({ policy_number: e.target.value })}
            style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #93c5fd" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Deductible ($)</span>
          <input
            type="number"
            min={0}
            value={data.deductible}
            onChange={(e) =>
              update({ deductible: parseFloat(e.target.value) || 0 })
            }
            style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #93c5fd" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Claim Number</span>
          <input
            value={data.claim_number ?? ""}
            onChange={(e) => update({ claim_number: e.target.value })}
            style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #93c5fd" }}
          />
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
          Customer Signature *
        </p>
        {data.customer_signature ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- signature is a dynamic data URL; next/image does not support data: URLs */}
            <img
              src={data.customer_signature}
              alt="Customer signature"
              style={{
                maxHeight: 80,
                border: "1px solid #93c5fd",
                borderRadius: 4,
                background: "#fff",
              }}
            />
            <button
              type="button"
              onClick={() => update({ customer_signature: "" })}
              style={{
                marginTop: 4,
                display: "block",
                fontSize: 12,
                color: "#dc2626",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear signature
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: 12,
              border: "1px dashed #93c5fd",
              borderRadius: 4,
              color: "#6b7280",
              fontSize: 13,
            }}
          >
            No signature captured yet. Capture signature via the signature pad
            below.
            {/* Signature-pad integration point — wire up your canvas/pad component here */}
          </div>
        )}
      </div>
    </section>
  );
}

function InvoiceSummary({
  services,
  insuranceMode,
}: {
  services: ServiceItem[];
  insuranceMode: boolean;
}) {
  const total = computeTotal(services, insuranceMode);

  return (
    <section
      style={{
        marginBottom: 24,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          fontSize: 18,
        }}
      >
        <span>Total</span>
        <span>${(total / 100).toFixed(2)}</span>
      </div>
      {insuranceMode && (
        <p style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
          Billed to insurance at insurance rates.
        </p>
      )}
    </section>
  );
}

function InvoiceActions({
  status,
  isPendingSend,
  isPendingPaid,
  onSend,
  onMarkPaid,
}: {
  status: InvoiceStatus;
  isPendingSend: boolean;
  isPendingPaid: boolean;
  onSend: () => void;
  onMarkPaid: () => void;
}) {
  if (status === "paid") return null;

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {status !== "sent" && (
        <button
          type="button"
          disabled={isPendingSend}
          onClick={onSend}
          style={{
            padding: "10px 24px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: isPendingSend ? "not-allowed" : "pointer",
            opacity: isPendingSend ? 0.7 : 1,
          }}
        >
          {isPendingSend ? "Sending…" : "Send Invoice"}
        </button>
      )}
      <button
        type="button"
        disabled={isPendingPaid}
        onClick={onMarkPaid}
        style={{
          padding: "10px 24px",
          borderRadius: 6,
          border: "none",
          background: "#16a34a",
          color: "#fff",
          fontWeight: 600,
          cursor: isPendingPaid ? "not-allowed" : "pointer",
          opacity: isPendingPaid ? 0.7 : 1,
        }}
      >
        {isPendingPaid ? "Saving…" : "Mark as Paid"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared mutation helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core database work shared by both sendInvoiceMutation and markPaidMutation:
 *  1. Validates insurance when insurance_mode is true (throws on failure).
 *  2. Computes the correct total (insurance vs standard rates).
 *  3. Patches services_json so stored prices reflect the active mode.
 *  4. Updates the tech_invoices row.
 *
 * The caller supplies the desired status and is responsible for any additional
 * side-effects (e.g. updating the appointment when marking paid).
 */
async function submitInvoiceUpdate({
  invoiceId,
  services,
  insuranceMode,
  insuranceData,
  status,
}: {
  invoiceId: string;
  services: ServiceItem[];
  insuranceMode: boolean;
  insuranceData: InsuranceData | null;
  status: "sent" | "paid";
}): Promise<void> {
  // 1. Validate insurance when insurance mode is active.
  if (insuranceMode) {
    const validationError = validateInsurance(insuranceData);
    if (validationError) throw new Error(validationError);
  }

  // 2 & 3. Compute totals and patch services_json.
  const patchedServices = patchServicesForMode(services, insuranceMode);
  const total = computeTotal(services, insuranceMode);

  // 4. Write to tech_invoices.
  const { error } = await supabase
    .from("tech_invoices")
    .update({
      status,
      services_json: patchedServices,
      total,
      insurance_data: insuranceMode ? insuranceData : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [forceEditMode, setForceEditMode] = useState(false);
  const [insuranceData, setInsuranceData] = useState<InsuranceData>({
    company: "",
    policy_number: "",
    deductible: 0,
    customer_signature: "",
  });

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: invoice,
    isLoading,
    error: fetchError,
  } = useQuery<TechInvoice>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_invoices")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as TechInvoice;
    },
    enabled: !!id,
  });

  // ── Receipt mode ───────────────────────────────────────────────────────────
  // The invoice is read-only (receipt view) when it has been sent or paid and
  // the tech has not explicitly entered edit mode.

  const receiptMode =
    (invoice?.status === "sent" || invoice?.status === "paid") &&
    !forceEditMode;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateInvoice = () => {
    queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const [mutationError, setMutationError] = useState<string | null>(null);

  // Shared pre-flight: always read the latest local insurance state before
  // submitting so we never act on a stale snapshot.  All required fields are
  // given explicit defaults so the merge always yields a complete InsuranceData.
  function getLatestInsuranceData(): InsuranceData | null {
    if (!invoice?.insurance_mode) return null;
    // Explicit defaults ensure required fields are never undefined after merge.
    const persisted: InsuranceData = {
      company: "",
      policy_number: "",
      deductible: 0,
      customer_signature: "",
      ...(invoice.insurance_data ?? {}),
    };
    return { ...persisted, ...insuranceData };
  }

  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("Invoice not loaded.");
      setMutationError(null);
      await submitInvoiceUpdate({
        invoiceId: invoice.id,
        services: invoice.services_json,
        insuranceMode: invoice.insurance_mode,
        insuranceData: getLatestInsuranceData(),
        status: "sent",
      });
    },
    onSuccess: invalidateInvoice,
    onError: (err: Error) => setMutationError(err.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("Invoice not loaded.");
      setMutationError(null);

      // Shared update (status = "paid").
      await submitInvoiceUpdate({
        invoiceId: invoice.id,
        services: invoice.services_json,
        insuranceMode: invoice.insurance_mode,
        insuranceData: getLatestInsuranceData(),
        status: "paid",
      });

      // Extra step unique to markPaid: update the linked appointment.
      if (invoice.appointment_id) {
        const { error: apptError } = await supabase
          .from("appointments")
          .update({ status: "completed" })
          .eq("id", invoice.appointment_id);
        if (apptError) throw apptError;
      }
    },
    onSuccess: () => {
      invalidateInvoice();
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err: Error) => setMutationError(err.message),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: "#6b7280" }}>Loading invoice…</div>
    );
  }

  if (fetchError || !invoice) {
    return (
      <div style={{ padding: 32, color: "#dc2626" }}>
        {fetchError
          ? `Error loading invoice: ${(fetchError as Error).message}`
          : "Invoice not found."}
      </div>
    );
  }

  const services = invoice.services_json ?? [];

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <InvoiceHeader
        invoice={invoice}
        onForceEdit={() => setForceEditMode(true)}
      />

      {receiptMode ? (
        // Read-only receipt view
        <>
          <ServicesList
            services={services}
            insuranceMode={invoice.insurance_mode}
          />
          <InvoiceSummary
            services={services}
            insuranceMode={invoice.insurance_mode}
          />
        </>
      ) : (
        // Editable view
        <>
          <ServicesList
            services={services}
            insuranceMode={invoice.insurance_mode}
          />

          {invoice.insurance_mode && (
            <InsuranceSection
              data={{
                ...(invoice.insurance_data ?? {
                  company: "",
                  policy_number: "",
                  deductible: 0,
                  customer_signature: "",
                }),
                ...insuranceData,
              }}
              onChange={setInsuranceData}
            />
          )}

          <InvoiceSummary
            services={services}
            insuranceMode={invoice.insurance_mode}
          />

          {mutationError && (
            <p
              style={{
                marginBottom: 12,
                color: "#dc2626",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {mutationError}
            </p>
          )}

          <InvoiceActions
            status={invoice.status}
            isPendingSend={sendInvoiceMutation.isPending}
            isPendingPaid={markPaidMutation.isPending}
            onSend={() => sendInvoiceMutation.mutate()}
            onMarkPaid={() => markPaidMutation.mutate()}
          />
        </>
      )}
    </main>
  );
}
