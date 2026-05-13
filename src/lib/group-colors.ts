export const CLINIC_GROUP_COLOR_SLOT_COUNT = 21;

export const LEGACY_GROUP_COLOR_HEX: Record<string, string> = {
  gray: "#E5E7EB",
  lavender: "#C4B5FD",
  peach: "#FDBA74",
  rose: "#FDA4AF",
  sage: "#86EFAC",
  sky: "#7DD3FC",
};

export const DEFAULT_GROUP_COLOR_SLOT_SEEDS = [
  { alpha: 100, colorHex: LEGACY_GROUP_COLOR_HEX.gray, slotIndex: 0 },
  { alpha: 100, colorHex: LEGACY_GROUP_COLOR_HEX.lavender, slotIndex: 1 },
  { alpha: 100, colorHex: LEGACY_GROUP_COLOR_HEX.sage, slotIndex: 2 },
  { alpha: 100, colorHex: LEGACY_GROUP_COLOR_HEX.peach, slotIndex: 3 },
  { alpha: 100, colorHex: LEGACY_GROUP_COLOR_HEX.sky, slotIndex: 4 },
  { alpha: 100, colorHex: LEGACY_GROUP_COLOR_HEX.rose, slotIndex: 5 },
] as const;

export type RgbColor = { b: number; g: number; r: number };
export type HsvColor = { h: number; s: number; v: number };
export type CmykColor = { c: number; k: number; m: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const normalizeHexColor = (value: string) => {
  const trimmed = value.trim().replace(/^#/, "");

  if (trimmed.length === 3) {
    const expanded = trimmed
      .split("")
      .map((char) => char + char)
      .join("");

    return /^([0-9a-fA-F]{6})$/.test(expanded) ? `#${expanded.toUpperCase()}` : null;
  }

  return /^([0-9a-fA-F]{6})$/.test(trimmed) ? `#${trimmed.toUpperCase()}` : null;
};

export const hexToRgb = (hex: string): RgbColor | null => {
  const normalized = normalizeHexColor(hex);

  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

export const rgbToHex = ({ b, g, r }: RgbColor) =>
  `#${[r, g, b].map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

export const rgbToHsv = ({ b, g, r }: RgbColor): HsvColor => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let h = 0;

  if (delta !== 0) {
    if (max === red) {
      h = ((green - blue) / delta) % 6;
    } else if (max === green) {
      h = (blue - red) / delta + 2;
    } else {
      h = (red - green) / delta + 4;
    }
  }

  return {
    h: Math.round((((h * 60) + 360) % 360) * 100) / 100,
    s: Math.round((max === 0 ? 0 : delta / max) * 10000) / 100,
    v: Math.round(max * 10000) / 100,
  };
};

export const hsvToRgb = ({ h, s, v }: HsvColor): RgbColor => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const value = clamp(v, 0, 100) / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  };
};

export const rgbToCmyk = ({ b, g, r }: RgbColor): CmykColor => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const k = 1 - Math.max(red, green, blue);

  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  return {
    c: Math.round((((1 - red - k) / (1 - k)) * 100) * 100) / 100,
    m: Math.round((((1 - green - k) / (1 - k)) * 100) * 100) / 100,
    y: Math.round((((1 - blue - k) / (1 - k)) * 100) * 100) / 100,
    k: Math.round(k * 10000) / 100,
  };
};

export const cmykToRgb = ({ c, k, m, y }: CmykColor): RgbColor => {
  const cyan = clamp(c, 0, 100) / 100;
  const magenta = clamp(m, 0, 100) / 100;
  const yellow = clamp(y, 0, 100) / 100;
  const key = clamp(k, 0, 100) / 100;

  return {
    r: Math.round(255 * (1 - cyan) * (1 - key)),
    g: Math.round(255 * (1 - magenta) * (1 - key)),
    b: Math.round(255 * (1 - yellow) * (1 - key)),
  };
};

export const alphaPercentToCss = (alpha: number) => clamp(alpha, 0, 100) / 100;

export const toRgbaString = (hex: string, alpha = 100) => {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return `rgba(148, 163, 184, ${alphaPercentToCss(alpha)})`;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaPercentToCss(alpha)})`;
};

export const getReadableTextColor = (hex: string) => {
  const rgb = hexToRgb(hex);

  if (!rgb) {
    return "#111827";
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#111827" : "#F8FAFC";
};

export const getLegacyGroupHex = (value: string) => normalizeHexColor(value) ?? LEGACY_GROUP_COLOR_HEX[value] ?? "#94A3B8";
