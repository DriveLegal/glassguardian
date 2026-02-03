// app/head.tsx
export default function Head() {
  return (
    <>
      {/* Basic */}
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <title>Glass Guardian — Chip & Crack Repair</title>
      <meta
        name="description"
        content="Mobile chip & crack repair done right — insurance-friendly, fast, and guaranteed. We come to you, restore clarity, and back it with a 1-year warranty."
      />

      {/* App-like behavior */}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Glass Guardian" />
      <meta name="theme-color" content="#020617" />

      {/* Icons (replace paths if you have actual files) */}
      <link rel="icon" href="/icons/favicon-32x32.png" sizes="32x32" />
      <link rel="icon" href="/icons/favicon-16x16.png" sizes="16x16" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.json" />

      {/* SEO / social preview */}
      <meta property="og:title" content="Glass Guardian — Chip & Crack Repair" />
      <meta
        property="og:description"
        content="Fast, insurance-friendly chip & crack repair. We come to you and guarantee clarity & protection."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://glassguardianchipandcrackrepair.com" />
      <meta property="og:image" content="https://glassguardianchipandcrackrepair.com/og-cover.jpg" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Glass Guardian — Chip & Crack Repair" />
      <meta
        name="twitter:description"
        content="Mobile chip & crack repair done right. Fast, guaranteed, and insurance-friendly."
      />
      <meta name="twitter:image" content="https://glassguardianchipandcrackrepair.com/og-cover.jpg" />

      {/* Progressive enhancement */}
      <meta name="format-detection" content="telephone=no" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

      {/* Preload key font for faster paint (optional) */}
      <link
        rel="preload"
        href="/fonts/Inter-Variable.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
    </>
  );
}