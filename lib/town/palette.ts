// DESIGN.md color tokens as hex, for the 3D scene (three.js can't read Tailwind
// classes). Same values as DESIGN.md; add nothing here that DESIGN.md lacks.
export const TOKENS = {
  canvas: "#ffffff",
  surface: "#f6f5f4",
  hairline: "#e5e3df",
  hairlineSoft: "#ede9e4",
  hairlineStrong: "#c8c4be",
  steel: "#787671",
  charcoal: "#37352f",
  cardTintMint: "#d9f3e1",
  cardTintSky: "#dcecfa",
  cardTintLavender: "#e6e0f5",
  cardTintCream: "#f8f5e8",
  cardTintGray: "#f0eeec",
  brandGreen: "#1aae39",
  brandBrown: "#523410",
  brandYellow: "#f5d75e",
  brandTeal: "#2a9d99",
} as const;

// Friend colors in join order (design-spec.md, "Friend colors").
export const FRIEND_COLORS = [
  { token: "brand-orange", hex: "#dd5b00" },
  { token: "brand-teal", hex: "#2a9d99" },
  { token: "brand-pink", hex: "#ff64c8" },
  { token: "brand-green", hex: "#1aae39" },
  { token: "brand-yellow", hex: "#f5d75e" },
  { token: "brand-purple", hex: "#7b3ff2" },
] as const;

export function friendColor(colorIndex: number) {
  return FRIEND_COLORS[colorIndex % FRIEND_COLORS.length];
}

// Tailwind classes for the same colors, written out in full so Tailwind sees them.
const FRIEND_BG = [
  "bg-brand-orange",
  "bg-brand-teal",
  "bg-brand-pink",
  "bg-brand-green",
  "bg-brand-yellow",
  "bg-brand-purple",
];
const FRIEND_RING = [
  "ring-brand-orange",
  "ring-brand-teal",
  "ring-brand-pink",
  "ring-brand-green",
  "ring-brand-yellow",
  "ring-brand-purple",
];

export function friendBgClass(colorIndex: number) {
  return FRIEND_BG[colorIndex % FRIEND_BG.length];
}

export function friendRingClass(colorIndex: number) {
  return FRIEND_RING[colorIndex % FRIEND_RING.length];
}
