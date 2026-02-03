// lib/supabaseServer.ts
import { cookies } from "next/headers";
import {
  createServerComponentClient,
  createRouteHandlerClient,
} from "@supabase/auth-helpers-nextjs";

/** Use inside Server Components / layouts / server actions */
export function supabaseServer() {
  return createServerComponentClient({ cookies });
}

/** Use inside app/api/** route handlers */
export function supabaseRoute() {
  return createRouteHandlerClient({ cookies });
}