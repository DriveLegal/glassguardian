// scripts/set-admin-role.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!; // DO NOT ship to client

const supabase = createClient(url, service);

async function main() {
  const email = process.argv[2]; // pass the email on CLI
  if (!email) throw new Error("Usage: ts-node set-admin-role.ts user@example.com");

  // find user
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error("User not found");

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), role: "admin" },
  });
  if (error) throw error;
  console.log("Updated:", data.user?.email, "role=admin");
}

main().catch((e) => { console.error(e); process.exit(1); });