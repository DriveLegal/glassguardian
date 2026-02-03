// components/PhotoUploadAdvanced.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Image as ImageIcon, X } from "lucide-react";

type Props = {
  photoType: string;
  label: string;
  required?: boolean;
  existingPhoto?: string | null;
  /** Server-action-safe name */
  onUploadAction: (file: File | null, photoType: string) => void;
  className?: string;
};

export default function PhotoUploadAdvanced({
  photoType,
  label,
  required = false,
  existingPhoto,
  onUploadAction,
  className = "",
}: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFile = (file: File | null) => {
    onUploadAction(file, photoType);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    handleFile(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f && f.type.startsWith("image/")) handleFile(f);
  };

  return (
    <div
      className={`relative rounded-2xl border-2 ${dragOver ? "border-blue-400 bg-blue-50" : "border-dashed border-gray-300 bg-white"} p-4 shadow-sm ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Label className="font-semibold text-gray-900">{label}</Label>
          {required && (
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 border border-red-200">
              Required
            </span>
          )}
        </div>
        {existingPhoto && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleFile(null)}
            className="gap-1"
            title="Remove photo"
          >
            <X className="w-4 h-4" />
            Remove
          </Button>
        )}
      </div>

      <div
        className="relative grid place-items-center rounded-xl overflow-hidden border bg-gray-50"
        style={{ minHeight: 180 }}
        onClick={() => inputRef.current?.click()}
        role="button"
      >
        {existingPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={existingPhoto} alt={label} className="w-full h-56 object-cover" />
        ) : (
          <div className="text-center text-gray-500 p-6">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-70" />
            <p className="text-sm">Drag & drop a photo here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">JPEG / PNG / HEIC</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onChange}
          className="hidden"
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="gap-2">
          <Camera className="w-4 h-4" />
          Take / Choose Photo
        </Button>
        {existingPhoto && <span className="text-xs text-gray-500">Tap preview to replace</span>}
      </div>
    </div>
  );
}