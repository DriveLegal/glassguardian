// lib/seasonal.ts
export type SeasonKey = "none" | "halloween" | "winter" | "summer";

export type SeasonalConfig = {
  active: SeasonKey;
  accents?: Partial<{ accentA: string; accentB: string; accentC: string }>;
  overlayImage?: string;
  overlayOpacity?: number;
};

export const seasonalConfig: SeasonalConfig = {
  active: "halloween",
  overlayImage: "/overlays/raw/halloween-ghosts.webm",
  overlayOpacity: 0.18,
};