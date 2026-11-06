import { createContext, useEffect, type ReactNode, useState, useCallback } from "react";
import { match } from "ts-pattern";

import { buildColorPalette, pickMostReadableColor, readCssVariable } from "./helpers";
import { PALETTE_SHADES } from "./theme.constants";
import { useThemeStore } from "./themeStore";

import type { ColorPalette } from "./helpers";
import type { ColorSchema } from "./theme.types";

type ThemeContextType = {
  colorSchema: ColorSchema;
  palette: ColorPalette;
  setColorSchema: (colorSchema: ColorSchema) => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const readPaletteFromDocument = () =>
  Object.fromEntries(
    PALETTE_SHADES.map((shade) => [shade, readCssVariable(`--primary-${shade}`)]),
  ) as ColorPalette;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  const [colorSchema, setColorSchemaState] = useState<ColorSchema>(() => ({
    primaryColor: readCssVariable("--brand"),
    contrastColor: readCssVariable("--color-white"),
    backgroundColor: null,
    accentColor: null,
  }));
  const [palette, setPalette] = useState<ColorPalette>(readPaletteFromDocument);

  const writeColorSchemaToDocument = useCallback((nextColorSchema: ColorSchema) => {
    const { primaryColor, contrastColor, backgroundColor, accentColor } = nextColorSchema;
    const nextPalette = buildColorPalette(primaryColor, { backgroundColor, accentColor });

    setColorSchemaState(nextColorSchema);
    setPalette(nextPalette);

    Object.entries(nextPalette).forEach(([shade, hex]) => {
      document.documentElement.style.setProperty(`--primary-${shade}`, hex);
    });

    document.documentElement.style.setProperty(`--brand`, primaryColor);
    document.documentElement.style.setProperty(`--contrast`, contrastColor);
    document.documentElement.style.setProperty(
      `--color-contrast`,
      pickMostReadableColor(primaryColor, [nextPalette[800], nextPalette[100]]),
    );
  }, []);

  useEffect(() => {
    match(theme)
      .with("dark", () => {
        document.documentElement.classList.add("dark");
      })
      .with("light", () => {
        document.documentElement.classList.remove("dark");
      })
      .exhaustive();
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        colorSchema,
        palette,
        setColorSchema: writeColorSchemaToDocument,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
