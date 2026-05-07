export function roleHexFromInt(color?: number | null): string | undefined {
  if (!color) return undefined;
  return "#" + color.toString(16).padStart(6, "0");
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function readableRoleColor(
  hex: string | undefined,
  theme: "light" | "dark",
): string | undefined {
  if (!hex) return undefined;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const lum = relativeLuminance(r, g, b);
  if (theme === "light") {
    if (lum < 0.45) return hex;
    return rgbToHex(mix(r, 0, 0.5), mix(g, 0, 0.5), mix(b, 0, 0.5));
  }
  if (lum > 0.05) return hex;
  return rgbToHex(mix(r, 255, 0.45), mix(g, 255, 0.45), mix(b, 255, 0.45));
}
