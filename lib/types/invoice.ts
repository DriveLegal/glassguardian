// lib/types/invoice.ts

export interface ServiceItem {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  /** Standard (non-insurance) unit price in cents */
  price: number;
  /** Insurance unit price in cents; falls back to price when absent */
  insurance_price?: number;
}

export interface InsuranceData {
  company: string;
  policy_number: string;
  deductible: number;
  /** Base-64 PNG or signature URL collected from the customer */
  customer_signature: string;
  claim_number?: string;
  adjuster_name?: string;
  adjuster_phone?: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface TechInvoice {
  id: string;
  status: InvoiceStatus;
  services_json: ServiceItem[];
  insurance_mode: boolean;
  insurance_data: InsuranceData | null;
  /** Total in cents */
  total: number;
  appointment_id: string | null;
  tech_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  created_at: string;
  updated_at: string;
}
