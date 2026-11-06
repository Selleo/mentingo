import { createContext, useEffect, type ReactNode, useState, useCallback } from "react";
import { match } from "ts-pattern";

import { buildPrimaryPalette, getContrastRatio } from "./helpers";
import { useThemeStore } from "./themeStore";

type ThemeContextType = {
  primaryColor: string;
  contrastColor: string;
  setColorSchema: (primaryColor: string, contrastColor: string) => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  const [primaryColor, setPrimaryColor] = useState(
    getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
  );
  const [contrastColor, setContrastColor] = useState(
    getComputedStyle(document.documentElement).getPropertyValue("--color-white").trim(),
  );

  const handleSetColorSchema = useCallback((primaryColor: string, contrastColor: string) => {
    setPrimaryColor(primaryColor);
    setContrastColor(contrastColor);

    const palette = buildPrimaryPalette(primaryColor);

    Object.entries(palette).forEach(([shade, hex]) => {
      document.documentElement.style.setProperty(`--primary-${shade}`, hex);
    });

    document.documentElement.style.setProperty(`--brand`, primaryColor);
    document.documentElement.style.setProperty(`--contrast`, contrastColor);
    document.documentElement.style.setProperty(
      `--color-contrast`,
      getContrastRatio(primaryColor, palette[800]) >= getContrastRatio(primaryColor, palette[100])
        ? palette[800]
        : palette[100],
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
      value={{ primaryColor, contrastColor, setColorSchema: handleSetColorSchema }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
