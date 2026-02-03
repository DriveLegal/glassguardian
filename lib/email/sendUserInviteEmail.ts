// lib/email/sendUserInviteEmail.ts
type SendUserInviteEmailParams = {
  to: string;
  fullName: string;
  code: string;
  inviteUrl: string;
};

export async function sendUserInviteEmail({
  to,
  fullName,
  code,
  inviteUrl,
}: SendUserInviteEmailParams) {
  // TODO: Wire this up to your real email provider.
  // For example, mirror whatever you're doing for tech invite emails.
  // This stub keeps things from crashing in the meantime.
  console.log(
    "[sendUserInviteEmail] Would send user invite email:",
    JSON.stringify({ to, fullName, code, inviteUrl }, null, 2)
  );

  // Example (Resend / Nodemailer / etc) would go here.
}