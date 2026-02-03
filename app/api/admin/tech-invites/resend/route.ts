// app/api/admin/tech-invites/resend/route.ts
import { NextResponse } from "next/server";

type ResendBody = {
  email: string;
};

export async function POST(req: Request) {
  try {
    const { email }: ResendBody = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Missing required field: email" },
        { status: 400 }
      );
    }

    // Forward the same Authorization header to the base route
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization") || "";

    // Build absolute URL for the existing /api/admin/tech-invites route
    const baseUrl = new URL(req.url);
    const target = new URL("/api/admin/tech-invites", baseUrl.origin);

    const forwardRes = await fetch(target.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        email,
        reason: "resend",
      }),
    });

    const json = await forwardRes.json().catch(() => ({} as any));

    if (!forwardRes.ok) {
      return NextResponse.json(
        { error: json?.error || "Failed to resend invite" },
        { status: forwardRes.status }
      );
    }

    return NextResponse.json(
      {
        message: "Invite email resent",
        invite: json?.invite ?? null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in /api/admin/tech-invites/resend:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to resend invite" },
      { status: 500 }
    );
  }
}