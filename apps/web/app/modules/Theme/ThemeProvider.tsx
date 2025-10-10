import { createContext, useEffect, type ReactNode, useState, useCallback } from "react";
import { match } from "ts-pattern";

import { getContrastColor, hexToHslTuple, hslToHex } from "./helpers";
import { useThemeStore } from "./themeStore";

type ThemeContextType = {
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  const [primaryColor, setPrimaryColor] = useState(
    getComputedStyle(document.documentElement).getPropertyValue("--primary-700").trim(),
  );

  const handleSetPrimaryColor = useCallback((color: string) => {
    setPrimaryColor(color);

    const [h, s, l] = hexToHslTuple(color);

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

    document.documentElement.style.setProperty(
      `--contrast`,
      getComputedStyle(document.documentElement)
        .getPropertyValue(getContrastColor(color, "--color-black", "--color-white"))
        .trim(),
    );
    document.documentElement.style.setProperty(
      `--color-contrast`,
      getComputedStyle(document.documentElement)
        .getPropertyValue(getContrastColor(color, "--primary-800", "--primary-100"))
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
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor: handleSetPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
