// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";

import ClientRoot from "./ClientRoot";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glass Guardian – Chip & Crack Repair",
  description:
    "Premium mobile chip & crack repair. Insurance-friendly, fast, guaranteed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#050505",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} dark`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className="
          bg-[#050505]
          text-slate-50
          antialiased
          [font-synthesis-weight:none]
          [text-rendering:optimizeLegibility]
        "
      >
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}