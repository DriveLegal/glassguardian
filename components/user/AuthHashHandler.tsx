// components/user/AuthHashHandler.tsx
"use client";

import * as React from "react";

export function AuthHashHandler() {
  const [authError, setAuthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    if (!hash) return;

    // Interpret the hash as a querystring (remove leading '#')
    const params = new URLSearchParams(hash.replace(/^#/, ""));

    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");

    // If there is an explicit error in the hash, surface it
    if (error || errorCode) {
      if (errorCode === "otp_expired") {
        setAuthError(
          "This magic login link is invalid or has already been used. Please request a fresh login email from Glass Guardian."
        );
      } else {
        setAuthError(
          errorDescription ||
            "There was a problem verifying your login link. Please request a new one."
        );
      }
      return;
    }

    // No error in the hash:
    // Supabase v2 (with detectSessionInUrl: true) will have already
    // consumed any access_token/refresh_token from the URL when the
    // client was initialized. Here we just clean the hash if it looks
    // like an auth payload.
    const hasAuthTokens =
      params.has("access_token") ||
      params.has("refresh_token") ||
      params.has("expires_in");

    if (hasAuthTokens) {
      try {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );
      } catch {
        // best-effort only
      }
    }
  }, []);

  if (!authError) return null;

  // Tiny, reusable banner wherever you place this component
  return (
    <div className="mb-3 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      {authError}
    </div>
  );
}