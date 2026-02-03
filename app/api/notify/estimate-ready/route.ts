import { NextResponse } from "next/server";
// import { Resend } from 'resend'; // or your mailer

export async function POST(req: Request) {
  const payload = await req.json();
  // TODO: wire your email provider or Supabase function here
  // For now, just log:
  console.log("[notify] estimate-ready", payload);
  return NextResponse.json({ ok: true });
}