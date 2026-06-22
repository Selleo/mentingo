const DEFAULT_COLOR = "#1FD5F9";
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const RGB_COLOR_PATTERN = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/;
const CSS_VARIABLE_PATTERN = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/;

const defaultRgbColor = [31 / 255, 213 / 255, 249 / 255];

const parseResolvedColor = (color: string) => {
  const hexColor = color.match(HEX_COLOR_PATTERN);

  if (hexColor) {
    const [, r = "00", g = "00", b = "00"] = hexColor;

    return [r, g, b].map((channel) => Number.parseInt(channel, 16) / 255);
  }

  const rgbColor = color.match(RGB_COLOR_PATTERN);

  if (rgbColor) {
    const [, r = "0", g = "0", b = "0"] = rgbColor;

    return [r, g, b].map((channel) => Number.parseInt(channel, 10) / 255);
  }

  return null;
};

const resolveCssColor = (color: string): string => {
  const trimmedColor = color.trim();
  const variable = trimmedColor.match(CSS_VARIABLE_PATTERN);

  if (!variable || typeof window === "undefined") {
    return trimmedColor;
  }

  const [, variableName, fallback] = variable;
  const variableValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  if (variableValue) {
    return resolveCssColor(variableValue);
  }

  if (fallback) {
    return resolveCssColor(fallback);
  }

  return DEFAULT_COLOR;
};

export const colorToRgb = (color = DEFAULT_COLOR) => {
  const resolvedColor = resolveCssColor(color);
  const rgbColor = parseResolvedColor(resolvedColor);

  if (rgbColor) {
    return rgbColor;
  }

  console.error(
    `Invalid visualizer color '${color}'. Falling back to default color '${DEFAULT_COLOR}'.`,
  );

  return defaultRgbColor;
};
