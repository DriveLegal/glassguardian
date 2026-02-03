// app/user/(protected)/dashboard/book/page.tsx  (Server Component)
import { Suspense } from "react";
import BookClient from "./BookClient";

export default function BookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading booking…</div>}>
      <BookClient />
    </Suspense>
  );
}