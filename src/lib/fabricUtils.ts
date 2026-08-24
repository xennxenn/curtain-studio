import { Settings } from "../types";

export const COLOR_NAME_TO_HEX: Record<string, string> = {
  "LONDON GRAY": "#5A5D64",
  "CHASSIS GREY": "#3F4248",
  "GOLDEN BRONZE": "#8C7B62",
  "CHAMPAGNE GOLD": "#D4C5A9",
  "COCOA BROWN": "#4E3E38",
  "CREAMY BEIGE": "#F2E8D5",
  "DEEP FOREST GREEN": "#1B3B32",
  "MIDNIGHT NAVY": "#1A2E40",
  "SAGE MIST": "#9AA69B",
  "WHITE": "#FBFBFC",
  "SOFT CREAM": "#FCF9EE",
  "CREAMY IVORY": "#fffff0",
  "SILVER SHIMMER": "#e2e2e4",
  "SNOW FLAKE": "#fcfcff",
  "NATURAL OAK": "#dfbf9f",
  "MATTE BLACK": "#111111",
  "PURE WHITE": "#ffffff",
  "PLATINUM SILVER": "#e5e4e2",
  "COOL GRAY": "#90a4ae",
  "SAND BEIGE": "#d7ccc8",
  "CHARCOAL BLACK": "#212121",
  "OFF WHITE": "#fafafa",
  "CHARCOAL COAL": "#2b2b2b",
  "IVORY CREAM": "#fdf6e2",
  "CHOCOLATE BROWN": "#3d2314",
  "WARM GREY": "#8a8581"
};

export const createColorSwatch = (colorOrHex: string): string => {
  try {
    const clean = colorOrHex.trim().toUpperCase();
    const fillStyle = COLOR_NAME_TO_HEX[clean] || (colorOrHex.startsWith("#") ? colorOrHex : "#cbd5e1");
    
    // In node/SSR environment, document won't exist. Guard it
    if (typeof document === "undefined") {
      return fillStyle;
    }
    
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = fillStyle;
      ctx.fillRect(0, 0, 100, 100);
      return canvas.toDataURL("image/png");
    }
    return fillStyle;
  } catch (e) {
    return colorOrHex;
  }
};

export const getSolidFabricSwatch = (
  fullName: string | null | undefined,
  settings: Settings,
  fallbackBase64?: string | null
): string | null => {
  if (!fullName) return fallbackBase64 || null;
  
  // Find in solidFabricMaterials
  let matched = (settings.solidFabricMaterials || []).find(
    (x) => `${x.name} / ${x.colorName}` === fullName || x.name === fullName
  );
  
  // Find in blindMaterials if not found
  if (!matched) {
    matched = (settings.blindMaterials || []).find(
      (x) => `${x.name} / ${x.colorName}` === fullName || x.name === fullName
    );
  }
  
  // Find in rollerMaterials if not found
  if (!matched) {
    matched = (settings.rollerMaterials || []).find(
      (x) => `${x.name} / ${x.colorName}` === fullName || x.name === fullName
    );
  }

  if (matched) {
    if (matched.imageBase64) {
      return matched.imageBase64;
    }
    const colorVal = matched.imageColorHex || matched.colorName;
    return createColorSwatch(colorVal);
  }
  
  return fallbackBase64 || null;
};

export const getSheerFabricSwatch = (
  fullName: string | null | undefined,
  settings: Settings,
  fallbackBase64?: string | null
): string | null => {
  if (!fullName) return fallbackBase64 || null;

  // Find in sheerFabricMaterials
  let matched = (settings.sheerFabricMaterials || []).find(
    (x) => `${x.name} / ${x.colorName}` === fullName || x.name === fullName
  );

  // Find in blindTapeMaterials if not found
  if (!matched) {
    matched = (settings.blindTapeMaterials || []).find(
      (x) => `${x.name} / ${x.colorName}` === fullName || x.name === fullName
    );
  }

  if (matched) {
    if (matched.imageBase64) {
      return matched.imageBase64;
    }
    const colorVal = matched.imageColorHex || matched.colorName;
    return createColorSwatch(colorVal);
  }

  return fallbackBase64 || null;
};
