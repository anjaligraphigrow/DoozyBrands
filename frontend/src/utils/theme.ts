export function getAccentForeground(accent: string): "#183247" | "#ffffff" {
  const normalized = accent.replace("#", "");

  if (normalized.length !== 6) {
    return "#ffffff";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance =
    (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.58 ? "#183247" : "#ffffff";
}
