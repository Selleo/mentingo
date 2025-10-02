/**
 * Convert a HEX color string into an HSL tuple [hue, saturation, lightness].
 * Example: "#ff0000" → [0, 100, 50]
 */
export const hexToHslTuple = (hex: string): [number, number, number] => {
  let red = 0;
  let green = 0;
  let blue = 0;

  // Parse shorthand HEX (#fff) → expand to full form
  if (hex.length === 4) {
    red = parseInt(hex[1] + hex[1], 16);
    green = parseInt(hex[2] + hex[2], 16);
    blue = parseInt(hex[3] + hex[3], 16);
  }
  // Parse full HEX (#rrggbb)
  else if (hex.length === 7) {
    red = parseInt(hex.slice(1, 3), 16);
    green = parseInt(hex.slice(3, 5), 16);
    blue = parseInt(hex.slice(5, 7), 16);
  }

  // Normalize RGB values to 0–1 range
  red /= 255;
  green /= 255;
  blue /= 255;

  // Get the min/max of the channels
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  // Lightness is the midpoint of max and min
  let hue = 0;
  let saturation = 0;
  const lightness = (maxChannel + minChannel) / 2;

  // If max != min → the color is not gray, calculate saturation & hue
  if (maxChannel !== minChannel) {
    const delta = maxChannel - minChannel;

    // Saturation depends on lightness
    saturation =
      lightness > 0.5 ? delta / (2 - maxChannel - minChannel) : delta / (maxChannel + minChannel);

    // Calculate hue depending on which channel is max
    switch (maxChannel) {
      case red:
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      case blue:
        hue = (red - green) / delta + 4;
        break;
    }

    hue /= 6; // normalize to 0–1
  }

  return [
    Math.round(hue * 360), // hue in degrees
    Math.round(saturation * 100), // saturation in %
    Math.round(lightness * 100), // lightness in %
  ];
};

/**
 * Convert HSL values into a HEX color string.
 * Example: (0, 100, 50) → "#ff0000"
 */
export const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  // Convert saturation and lightness to 0–1 range
  const sat = saturation / 100;
  const light = lightness / 100;

  // Chroma = intensity of the color (difference between max and min RGB)
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;

  // Secondary component based on hue
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));

  // Adjustment to match the target lightness
  const matchLightness = light - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  // Depending on the hue angle, set preliminary RGB values
  if (0 <= hue && hue < 60) [red, green, blue] = [chroma, x, 0];
  else if (60 <= hue && hue < 120) [red, green, blue] = [x, chroma, 0];
  else if (120 <= hue && hue < 180) [red, green, blue] = [0, chroma, x];
  else if (180 <= hue && hue < 240) [red, green, blue] = [0, x, chroma];
  else if (240 <= hue && hue < 300) [red, green, blue] = [x, 0, chroma];
  else if (300 <= hue && hue < 360) [red, green, blue] = [chroma, 0, x];

  // Helper: convert a normalized RGB value (0–1) into a 2-digit hex string
  const toHex = (channel: number) =>
    Math.round((channel + matchLightness) * 255)
      .toString(16)
      .padStart(2, "0");

  // Build the HEX string
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};
