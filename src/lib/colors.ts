// Domain accent colors — distinct, saturated, avoids status colors (blue, green, amber)
const DOMAIN_PALETTE = [
  { border: "#e11d48", bg: "#fef1f2", text: "#be123c" },   // rose
  { border: "#7c3aed", bg: "#f3f0ff", text: "#6d28d9" },   // violet
  { border: "#0891b2", bg: "#effcfd", text: "#0e7490" },   // cyan
  { border: "#c026d3", bg: "#faf0fc", text: "#a21caf" },   // fuchsia
  { border: "#d97706", bg: "#fefce8", text: "#b45309" },   // amber
  { border: "#db2777", bg: "#fdf1f7", text: "#be185d" },   // pink
  { border: "#0d9488", bg: "#f0fdfa", text: "#0f766e" },   // teal
  { border: "#9333ea", bg: "#f4f0fe", text: "#7e22ce" },   // purple
] as const;

export function domainColor(index: number) {
  return DOMAIN_PALETTE[index % DOMAIN_PALETTE.length];
}
