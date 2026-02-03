"use client";

import * as React from "react";
import { Camera, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  photoType: string;
  label: string;
  required?: boolean;
  /**
   * onUpload should handle uploading `file` and associating it with `photoType`.
   * Return a Promise; component will show a loading mask.
   */
  onUpload: (file: File, photoType: string) => Promise<void>;
  /** Existing photo URL to show as preview (if any). */
  existingPhoto?: string | null;
};

export default function PhotoUploadAdvanced({
  photoType,
  label,
  required = false,
  onUpload,
  existingPhoto = null,
}: Props) {
  const [preview, setPreview] = React.useState<string | null>(existingPhoto);
  const [uploading, setUploading] = React.useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      await onUpload(file, photoType);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
  };

  const inputId = `photo-${photoType}`;

  return (
    <div className="relative group">
      <Label className="text-base font-semibold mb-3 block">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative"
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              id={inputId}
            />
            <label
              htmlFor={inputId}
              className="block border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group"
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                  Tap to capture photo
                </p>
                <p className="text-xs text-gray-500 mt-1">or upload from gallery</p>
              </div>
            </label>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative rounded-xl overflow-hidden border-4 border-green-500 shadow-2xl group"
          >
            <img src={preview} alt={photoType} className="w-full h-64 object-cover" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white text-sm font-medium">
                  {photoType.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div className="absolute top-2 right-2 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="bg-white/90 hover:bg-white shadow-lg"
                onClick={handleRemove}
                aria-label="Remove photo"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="absolute top-2 left-2">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-semibold">Uploaded</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {uploading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-2"></div>
            <p className="text-sm font-medium text-gray-700">Uploading...</p>
          </div>
        </div>
      )}
    </div>
  );
}