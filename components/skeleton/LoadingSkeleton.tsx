// components/skeleton/LoadingSkeleton.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";

export function CardSkeleton() {
  return (
    <div className="border-none shadow-lg rounded-lg overflow-hidden bg-white">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-12 h-12 bg-gray-200 rounded-full"
          />
          <div className="flex-1 space-y-2">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
              className="h-4 bg-gray-200 rounded w-3/4"
            />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              className="h-3 bg-gray-200 rounded w-1/2"
            />
          </div>
        </div>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
          className="h-20 bg-gray-200 rounded"
        />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <motion.div
          key={idx}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: idx * 0.1 }}
          className="h-16 bg-gray-100 rounded-lg"
        />
      ))}
    </div>
  );
}