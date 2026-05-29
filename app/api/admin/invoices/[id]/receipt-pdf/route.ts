import "server-only";

import { NextResponse } from "next/server";

import { assertAdminRequest, getAdminSupabaseClient } from "@/lib/admin/apiAuth";
import {
  buildAdminReceiptPdf,
  getAdminReceiptPdfFilename,
  type AdminReceiptPdfInput,
} from "@/lib/pdf/adminReceiptPdf";

export const runtime = "nodejs";

async function fetchVehicleForInvoice(admin: any, invoice: any) {
  if (invoice.vehicle_id) {
    const byId = await admin
      .from("vehicles")
      .select("id, owner_email, make, model, year, color, vin, license_plate, insurance_carrier")
      .eq("id", invoice.vehicle_id)
      .maybeSingle();

    if (!byId.error && byId.data) return byId.data;
  }

  const ownerEmail = String(invoice.customer_email ?? "").trim().toLowerCase();
  if (ownerEmail) {
    const byOwner = await admin
      .from("vehicles")
      .select("id, owner_email, make, model, year, color, vin, license_plate, insurance_carrier")
      .eq("owner_email", ownerEmail)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byOwner.error && byOwner.data) return byOwner.data;
  }

  return null;
}

async function fetchTechnicianByEmail(admin: any, email: string | null | undefined) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const fromTechnicians = await admin
    .from("technicians")
    .select("email, full_name")
    .eq("email", normalized)
    .maybeSingle();

  if (!fromTechnicians.error && fromTechnicians.data) return fromTechnicians.data;

  const fromUsersPublic = await admin
    .from("users_public")
    .select("email, full_name")
    .eq("email", normalized)
    .maybeSingle();

  if (!fromUsersPublic.error && fromUsersPublic.data) return fromUsersPublic.data;

  return null;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = getAdminSupabaseClient();
    const auth = await assertAdminRequest(req, admin);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const { data: invoice, error } = await admin
      .from("tech_invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    const [vehicle, technician] = await Promise.all([
      fetchVehicleForInvoice(admin, invoice),
      fetchTechnicianByEmail(admin, invoice.technician_email),
    ]);

    const bytes = await buildAdminReceiptPdf({
      invoice,
      vehicle,
      technician,
    } satisfies AdminReceiptPdfInput);

    const filename = getAdminReceiptPdfFilename(invoice);
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);

    return new Response(ab, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to generate receipt PDF." },
      { status: 500 }
    );
  }
}
