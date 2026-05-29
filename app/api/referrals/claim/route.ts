import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Not authed" }, { status: 401 });

  const ref = (await cookies()).get("gg_ref")?.value?.trim() || "";
  if (!ref) return NextResponse.json({ ok: true, skipped: true });

  // Lookup code mapping
  const { data: codeRow, error: codeErr } = await supabase
    .from("referral_codes")
    .select("referral_code, referrer_email, referrer_user_id")
    .eq("referral_code", ref)
    .maybeSingle();

  if (codeErr || !codeRow) {
    return NextResponse.json({ ok: false, error: "Invalid referral code" }, { status: 400 });
  }

  const myEmail = user.email ?? null;

  // Prevent self-referrals by email
  if (myEmail && codeRow.referrer_email && myEmail.toLowerCase() === codeRow.referrer_email.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Self-referrals not allowed" }, { status: 400 });
  }

  // Upsert referral record for this referred user
  const payload = {
    referral_code: ref,
    referrer_email: codeRow.referrer_email,
    referrer_user_id: codeRow.referrer_user_id,
    referred_user_id: user.id,
    referred_email: myEmail,
    status: "signed_up",
  };

  const { error: upErr } = await supabase
    .from("referrals")
    .upsert(payload, { onConflict: "referred_user_id" });

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  // Clear cookie so it doesn't re-claim forever
  (await
        // Clear cookie so it doesn't re-claim forever
        cookies()).set("gg_ref", "", { path: "/", maxAge: 0 });

  return NextResponse.json({ ok: true });
}