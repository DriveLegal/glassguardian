// app/book/page.tsx
import type { Metadata } from "next";
import BookElitePublicClient from "./BookElitePublicClient";

export const metadata: Metadata = {
  title: "Quick Book • Glass Guardian",
};

export default function Page() {
  return <BookElitePublicClient />;
}