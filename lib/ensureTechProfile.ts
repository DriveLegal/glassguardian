// lib/ensureTechProfile.ts
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Ensure there's a technicians row for the currently logged-in tech.
 * - Uses current session access token
 * - Calls /api/tech/profile/ensure (service-role powered, role-checked)
 * - Fail-soft: never throws into UI
 */
export async function ensureTechProfile() {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) return;

  try {
    await fetch("/api/tech/profile/ensure", {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // keep explicit (some setups require a body for POST)
    });
  } catch {
    // No-op: don't block dashboard if this fails
  }
}