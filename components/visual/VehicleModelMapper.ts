// components/visual/VehicleModelMapper.ts
export type VehicleType = "sedan" | "suv" | "truck" | "sports" | "van";

export const VEHICLE_DATABASE: Record<
  string,
  { type: VehicleType; models: Record<string, VehicleType> }
> = {
  tesla: {
    type: "sedan",
    models: {
      "model 3": "sedan",
      "model s": "sedan",
      "model y": "suv",
      "model x": "suv",
      cybertruck: "truck",
    },
  },
  ford: {
    type: "truck",
    models: {
      "f-150": "truck",
      "f-250": "truck",
      "f-350": "truck",
      explorer: "suv",
      expedition: "suv",
      escape: "suv",
      bronco: "suv",
      mustang: "sports",
      "mustang mach-e": "suv",
      edge: "suv",
      ranger: "truck",
    },
  },
  chevrolet: {
    type: "truck",
    models: {
      silverado: "truck",
      "silverado 1500": "truck",
      "silverado 2500": "truck",
      tahoe: "suv",
      suburban: "suv",
      equinox: "suv",
      traverse: "suv",
      blazer: "suv",
      corvette: "sports",
      camaro: "sports",
      malibu: "sedan",
      colorado: "truck",
    },
  },
  ram: { type: "truck", models: { "1500": "truck", "2500": "truck", "3500": "truck" } },
  toyota: {
    type: "sedan",
    models: {
      camry: "sedan",
      corolla: "sedan",
      avalon: "sedan",
      prius: "sedan",
      rav4: "suv",
      "4runner": "suv",
      highlander: "suv",
      tacoma: "truck",
      tundra: "truck",
      sequoia: "suv",
      sienna: "van",
    },
  },
  honda: {
    type: "sedan",
    models: {
      accord: "sedan",
      civic: "sedan",
      insight: "sedan",
      "cr-v": "suv",
      pilot: "suv",
      passport: "suv",
      ridgeline: "truck",
      odyssey: "van",
    },
  },
  jeep: {
    type: "suv",
    models: {
      wrangler: "suv",
      "grand cherokee": "suv",
      cherokee: "suv",
      compass: "suv",
      renegade: "suv",
      gladiator: "truck",
    },
  },
  bmw: {
    type: "sedan",
    models: {
      "3 series": "sedan",
      "320i": "sedan",
      "330i": "sedan",
      "5 series": "sedan",
      "7 series": "sedan",
      x1: "suv",
      x3: "suv",
      x5: "suv",
      x7: "suv",
      m3: "sports",
      m5: "sports",
      z4: "sports",
    },
  },
  mercedes: {
    type: "sedan",
    models: {
      "c-class": "sedan",
      c300: "sedan",
      "e-class": "sedan",
      "s-class": "sedan",
      "a-class": "sedan",
      glc: "suv",
      gle: "suv",
      gls: "suv",
      gla: "suv",
      "amg gt": "sports",
    },
  },
  "mercedes-benz": {
    type: "sedan",
    models: { "c-class": "sedan", "e-class": "sedan", glc: "suv", gle: "suv" },
  },
  audi: {
    type: "sedan",
    models: {
      a3: "sedan",
      a4: "sedan",
      a6: "sedan",
      a8: "sedan",
      q3: "suv",
      q5: "suv",
      q7: "suv",
      q8: "suv",
      r8: "sports",
      tt: "sports",
    },
  },
  porsche: {
    type: "sports",
    models: {
      "911": "sports",
      "718": "sports",
      cayman: "sports",
      boxster: "sports",
      cayenne: "suv",
      macan: "suv",
      panamera: "sedan",
    },
  },
  nissan: {
    type: "sedan",
    models: {
      altima: "sedan",
      maxima: "sedan",
      sentra: "sedan",
      rogue: "suv",
      pathfinder: "suv",
      armada: "suv",
      frontier: "truck",
      titan: "truck",
      "370z": "sports",
      "gt-r": "sports",
    },
  },
  dodge: {
    type: "van",
    models: {
      "grand caravan": "van",
      durango: "suv",
      charger: "sedan",
      challenger: "sports",
      "ram 1500": "truck",
    },
  },
  chrysler: { type: "van", models: { pacifica: "van", "300": "sedan" } },
  gmc: {
    type: "truck",
    models: {
      sierra: "truck",
      "sierra 1500": "truck",
      "sierra 2500": "truck",
      yukon: "suv",
      acadia: "suv",
      terrain: "suv",
      canyon: "truck",
    },
  },
  ferrari: { type: "sports", models: {} },
  lamborghini: { type: "sports", models: {} },
  maserati: { type: "sports", models: {} },
  bentley: { type: "sedan", models: {} },
  "rolls-royce": { type: "sedan", models: {} },
  mazda: { type: "sedan", models: { "cx-5": "suv", "cx-9": "suv", "3": "sedan", "6": "sedan" } },
  subaru: { type: "suv", models: { outback: "suv", forester: "suv", crosstrek: "suv", impreza: "sedan" } },
  hyundai: {
    type: "sedan",
    models: { sonata: "sedan", elantra: "sedan", "santa fe": "suv", tucson: "suv", palisade: "suv" },
  },
  kia: {
    type: "sedan",
    models: { forte: "sedan", optima: "sedan", sorento: "suv", sportage: "suv", telluride: "suv" },
  },
  volkswagen: {
    type: "sedan",
    models: { jetta: "sedan", passat: "sedan", tiguan: "suv", atlas: "suv", golf: "sedan" },
  },
};

export function getVehicleType(make?: string, model?: string): VehicleType {
  if (!make) return "sedan";
  const makeLower = make.toLowerCase().trim();
  const modelLower = model?.toLowerCase().trim() || "";

  const makeData = VEHICLE_DATABASE[makeLower];
  if (makeData) {
    const modelType = makeData.models[modelLower];
    if (modelType) return modelType;
    return makeData.type;
  }

  // Heuristics
  if (modelLower.includes("f-150") || modelLower.includes("silverado") || modelLower.includes("ram"))
    return "truck";
  if (
    modelLower.includes("suv") ||
    modelLower.includes("explorer") ||
    modelLower.includes("tahoe") ||
    modelLower.includes("4runner")
  )
    return "suv";
  if (
    modelLower.includes("corvette") ||
    modelLower.includes("mustang") ||
    modelLower.includes("911") ||
    modelLower.includes("sports")
  )
    return "sports";
  if (modelLower.includes("van") || modelLower.includes("minivan") || modelLower.includes("caravan")) return "van";

  return "sedan";
}