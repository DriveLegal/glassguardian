// lib/notify.ts
// Thin helper that calls a Supabase Function (edge function) to send email.
// Safe to keep as-is; if the function isn't deployed yet, it will no-op/log.

type NotifyArgs = {
  recipientEmail: string;
  appointmentId: string;
  amount: number;
};

export async function notifyEstimateReady(args: NotifyArgs) {
  try {
    const res = await fetch("/api/notify/estimate-ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    // If you prefer Supabase edge functions:
    // const { data, error } = await supabaseClient.functions.invoke('estimate-ready', { body: args });
    // if (error) throw error;
    return res.ok;
  } catch (e) {
    console.warn("notifyEstimateReady failed (soft):", e);
    return false;
  }
}