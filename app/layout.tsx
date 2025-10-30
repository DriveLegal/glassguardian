// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import Background from "@/components/Background";

export const metadata = {
  title: "Glass Guardian – Chip & Crack Repair",
  description: "Premium mobile chip & crack repair. Insurance-friendly, fast, guaranteed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Background />
        {children}
      </body>
    </html>
  );
}