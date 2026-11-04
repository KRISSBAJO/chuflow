export function validFormColor(value?: string | null) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}
export function formTextColor(background: string) {
  const value = validFormColor(background) || "#ffffff";
  const rgb = [1, 3, 5].map((start) => {
    const channel = parseInt(value.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05)
    ? "#000000"
    : "#ffffff";
}
