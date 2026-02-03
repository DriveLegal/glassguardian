// lib/techAuth.ts
import { supabaseClient } from "@/lib/supabaseClient";
import { readDevRoleFromCookie, makeDevUser } from "@/lib/devSim";

type AnyObj = Record<string, any>;

export type TechIdentity = {
  email: string;
  displayName: string;
  devActive: boolean;
};

export async function getTechIdentity(): Promise<TechIdentity | null> {
  const { data } = await supabaseClient.auth.getSession();
  const session = data?.session ?? null;

  if (session?.user?.email) {
    const displayName =
      ((session.user.user_metadata as AnyObj)?.full_name as string) ||
      session.user.email.split("@")[0] ||
      "Tech";

    return {
      email: session.user.email,
      displayName,
      devActive: false,
    };
  }

  const role = readDevRoleFromCookie();
  if (role === "tech") {
    const dev = makeDevUser("tech");
    return {
      email: dev.email || "dev.tech@example.com",
      displayName: dev.user_metadata?.full_name || "Dev Tech",
      devActive: true,
    };
  }

  return null;
}