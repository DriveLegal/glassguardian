/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  reactStrictMode: true,

  async headers() {
    const isDev = process.env.NODE_ENV !== "production";

    // ✅ DEV: return NO headers at all to avoid iPhone Safari/WebView blank-screen issues
    // (We’ll re-enable dev headers after it loads reliably on device.)
    if (isDev) return [];

    // ✅ PROD CSP: keep your strict baseline (same as before)
    const prodCsp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' https: data: blob:",
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
          // Enforce HTTPS everywhere (HSTS)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },

          // Basic hardening
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },

          // ✅ CSP: strict in production
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
