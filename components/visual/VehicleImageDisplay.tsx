// components/visual/VehicleImageDisplay.tsx
"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Car } from "lucide-react";
import { getVehicleType } from "./VehicleModelMapper";

const VEHICLE_IMAGE_DATABASE: Record<string, string> = {
  "tesla|model y|white": "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&q=80",
  "tesla|model y|black": "https://images.unsplash.com/photo-1620891549027-942fdc95d3f5?w=800&q=80",
  "tesla|model 3|white": "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80",
  "tesla|model 3|black": "https://images.unsplash.com/photo-1536700503339-1e4b06520771?w=800&q=80",
  "tesla|model s|black": "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&q=80",
  "tesla|model x|white": "https://images.unsplash.com/photo-1571607388263-1044f9ea01dd?w=800&q=80",

  "ford|mustang|red": "https://images.unsplash.com/photo-1584345604047-a9e5f9f0e5e5?w=800&q=80",
  "ford|mustang|black": "https://images.unsplash.com/photo-1584345604476-8ec5cb4e7e5e?w=800&q=80",
  "ford|f-150|black": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
  "ford|f-150|white": "https://images.unsplash.com/photo-1587019158091-1a103c5dd17f?w=800&q=80",
  "ford|explorer|white": "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",

  "chevrolet|silverado|black": "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
  "chevrolet|tahoe|black": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",

  "jeep|wrangler|black": "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
  "jeep|wrangler|white": "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
  "jeep|grand cherokee|black": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",

  "porsche|911|black": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
  "porsche|911|white": "https://images.unsplash.com/photo-1611651338412-8403fa6e3599?w=800&q=80",

  "bmw|3 series|black": "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
  "bmw|x5|black": "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800&q=80",

  "mercedes|c-class|black": "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
  "mercedes|gle|white": "https://images.unsplash.com/photo-1606016159991-8e6d6b8b8b8b?w=800&q=80",

  "sedan|default": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80",
  "suv|default": "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
  "truck|default": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
  "sports|default": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80",
  "van|default": "https://images.unsplash.com/photo-1527786356703-4b100091cd2c?w=800&q=80",
};

const normalizeColor = (color?: string) => {
  if (!color) return "default";
  const colorLower = color.toLowerCase();

  if (colorLower.startsWith("#")) {
    const hex = colorLower.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (r < 50 && g < 50 && b < 50) return "black";
    if (r > 200 && g > 200 && b > 200) return "white";
    if (r > 150 && g < 100 && b < 100) return "red";
    if (r < 100 && g < 100 && b > 150) return "blue";
    if (r < 100 && g > 150 && b < 100) return "green";
    if (r > 150 && g > 150 && b < 100) return "yellow";
    if (r > 100 && g < 100 && b > 100) return "purple";
    return "silver";
  }

  if (colorLower.includes("white") || colorLower.includes("pearl")) return "white";
  if (colorLower.includes("black") || colorLower.includes("obsidian")) return "black";
  if (colorLower.includes("red") || colorLower.includes("crimson")) return "red";
  if (colorLower.includes("blue") || colorLower.includes("navy")) return "blue";
  if (colorLower.includes("silver") || colorLower.includes("gray") || colorLower.includes("grey")) return "silver";

  return "default";
};

type Props = {
  make?: string;
  model?: string;
  color?: string;
  year?: string | number;
  className?: string;
  showFallback3D?: boolean; // reserved if you want to mount the 3D model when no image
};

export default function VehicleImageDisplay({
  make,
  model,
  color,
  year,
  className = "",
}: Props) {
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [imageError, setImageError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!make || !model) {
      setImageUrl("");
      setLoading(false);
      return;
    }

    const makeLower = make.toLowerCase();
    const modelLower = model.toLowerCase();
    const colorName = normalizeColor(color);

    let key = `${makeLower}|${modelLower}|${colorName}`;
    let url = VEHICLE_IMAGE_DATABASE[key];

    if (!url) {
      key = `${makeLower}|${modelLower}|default`;
      url = VEHICLE_IMAGE_DATABASE[key];
    }

    if (!url) {
      const type = getVehicleType(make, model);
      url = VEHICLE_IMAGE_DATABASE[`${type}|default`];
    }

    if (!url) {
      url = VEHICLE_IMAGE_DATABASE["sedan|default"];
    }

    setImageUrl(url);
    setLoading(false);
  }, [make, model, color]);

  if (loading) {
    return (
      <div
        className={`relative ${className} bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden flex items-center justify-center`}
        style={{ minHeight: "250px" }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-12 w-12 border-b-4 border-blue-600"
        />
      </div>
    );
  }

  if (imageError || !imageUrl) {
    return (
      <div
        className={`relative ${className} bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden flex items-center justify-center`}
        style={{ minHeight: "250px" }}
      >
        <div className="text-center p-8">
          <Car className="w-20 h-20 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 font-medium">
            {year} {make} {model}
          </p>
          {color && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-lg" style={{ backgroundColor: color }} />
              <span className="text-sm text-gray-600">{color}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className} bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 rounded-2xl overflow-hidden shadow-2xl`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none z-10" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        src={imageUrl}
        alt={`${year ?? ""} ${make ?? ""} ${model ?? ""}`.trim()}
        onError={() => setImageError(true)}
        className="w-full h-full object-cover object-center"
        style={{ minHeight: "250px" }}
      />

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="text-2xl font-bold text-white mb-1">{year} {make}</h3>
          <p className="text-lg text-blue-200 font-semibold">{model}</p>
          {color && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-white/50 shadow-xl" style={{ backgroundColor: color }} />
              <span className="text-sm text-white/90 capitalize">{normalizeColor(color)}</span>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full pointer-events-none"
        whileHover={{ translateX: ["100%", "200%"], transition: { duration: 0.6 } }}
      />
    </div>
  );
}