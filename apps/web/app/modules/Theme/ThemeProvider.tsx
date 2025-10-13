import { createContext, useEffect, type ReactNode, useState, useCallback } from "react";
import { match } from "ts-pattern";

import { getContrastColor, hexToHslTuple, hslToHex } from "./helpers";
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
    getComputedStyle(document.documentElement).getPropertyValue("--primary-700").trim(),
  );
  const [contrastColor, setContrastColor] = useState(
    getComputedStyle(document.documentElement).getPropertyValue("--color-white").trim(),
  );

  const handleSetColorSchema = useCallback((primaryColor: string, contrastColor: string) => {
    setPrimaryColor(primaryColor);
    setContrastColor(contrastColor);

    const [h, s, l] = hexToHslTuple(primaryColor);

    const shades = {
      50: 97,
      100: 90,
      200: 80,
      300: 70,
      400: 60,
      500: 50,
      600: 40,
      700: l, // selected color
      800: 25,
      900: 15,
      950: 10,
    };

    Object.entries(shades).forEach(([key, lightness]) => {
      const hexShade = hslToHex(h, s, lightness);

      document.documentElement.style.setProperty(`--primary-${key}`, hexShade);
    });

    document.documentElement.style.setProperty(`--contrast`, contrastColor);
    document.documentElement.style.setProperty(
      `--color-contrast`,
      getComputedStyle(document.documentElement)
        .getPropertyValue(getContrastColor(primaryColor, "--primary-800", "--primary-100"))
        .trim(),
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
