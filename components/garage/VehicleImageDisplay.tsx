// components/garage/VehicleImageDisplay.tsx
"use client";

import * as React from "react";
import { supabaseClient } from "@/lib/supabaseClient";

type Props = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  className?: string;
  alt?: string;
  /** If the bucket is private, set this to true to use signed URLs */
  useSignedUrl?: boolean;
  /** Signed URL lifetime (seconds) */
  signedUrlTTL?: number;
  /** Filename to fetch within the resolved folder (default: 'front.png') */
  filename?: string;
};

const BUCKET = "car-images";
const FALLBACK = "_generic/default.png";

function slug(v?: string | number | null) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

async function fileExists(folder: string, filename: string) {
  const { data, error } = await supabaseClient.storage.from(BUCKET).list(folder, {
    limit: 100,
  });
  if (error) return false;
  return (data ?? []).some((it) => it.name === filename);
}

async function resolvePath(
  make?: string | null,
  model?: string | null,
  year?: number | null,
  color?: string | null,
  filename = "front.png"
): Promise<string> {
  const mk = slug(make);
  const md = slug(model);
  const yr = year ? String(year) : "";
  const cl = slug(color) || "default";

  const candidates: string[] = [];

  if (mk && md && yr) {
    candidates.push(`${mk}/${md}/${yr}/${cl}`);
    candidates.push(`${mk}/${md}/${yr}/default`);
  }
  if (mk && md) {
    candidates.push(`${mk}/${md}/_default`);
  }
  if (mk) {
    candidates.push(`${mk}/_default`);
  }
  candidates.push("_generic");

  for (const folder of candidates) {
    const found = await fileExists(folder, filename);
    if (found) return `${folder}/${filename}`;
  }
  return FALLBACK;
}

export default function VehicleImageDisplay({
  make,
  model,
  year,
  color,
  className,
  alt,
  useSignedUrl = false,
  signedUrlTTL = 60 * 10,
  filename = "front.png",
}: Props) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const path = await resolvePath(make, model, year ?? null, color, filename);

        if (useSignedUrl) {
          const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrl(path, signedUrlTTL);
          if (!cancelled) setUrl(error ? null : data?.signedUrl ?? null);
        } else {
          const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
          if (!cancelled) setUrl(data.publicUrl || null);
        }
      } catch {
        if (!cancelled) setUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [make, model, year, color, useSignedUrl, signedUrlTTL, filename]);

  if (loading) {
    return (
      <div
        className={`w-full ${className || ""} bg-slate-200/60 animate-pulse rounded-xl`}
        aria-busy="true"
      />
    );
  }

  if (!url) {
    return (
      <div
        className={`w-full ${className || ""} bg-slate-100 border rounded-xl grid place-items-center text-slate-500`}
      >
        No image available
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={
        alt ||
        `${make ?? "vehicle"} ${model ?? ""} ${year ?? ""} ${color ?? ""}`.trim()
      }
      className={`w-full object-contain rounded-xl ${className || ""}`}
      loading="lazy"
      decoding="async"
    />
  );
}