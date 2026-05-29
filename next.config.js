// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  reactStrictMode: true,

  // ✅ Allow next/image to load Supabase Storage images
  // ✅ Allow quality={100} images used across branding/reviews
  images: {
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cqlwnobyjjkkxmvplzhh.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    const isDev = process.env.NODE_ENV !== "production";

    // ✅ DEV: return NO headers at all to avoid iPhone Safari/WebView blank-screen issues
    if (isDev) return [];

    // ✅ PROD CSP: keep strict baseline, but ensure Supabase images work
    const prodCsp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",

      // ✅ Keep https/data/blob; explicitly add your Supabase host for clarity
      "img-src 'self' https: data: blob: https://cqlwnobyjjkkxmvplzhh.supabase.co",

      "font-src 'self' https: data:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https:",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: prodCsp,
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;