import { type LucideProps, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useThemeStore } from "~/modules/Theme/themeStore";

import { Button, type ButtonProps } from "../ui/button";

type ThemeToggleProps = {
  variant?: ButtonProps["variant"];
  className?: string;
};

export default function ThemeToggle({ className, variant = "ghost" }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();

  const ToggleIcon: React.FC<LucideProps> = (props) =>
    match(theme)
      .with("light", () => <Sun aria-hidden="true" {...props} />)
      .with("dark", () => <Moon aria-hidden="true" {...props} />)
      .exhaustive();

  return (
    <Button
      variant={variant}
      className={className}
      onClick={toggleTheme}
      aria-label={t(theme === "light" ? "a11y.switchToDarkMode" : "a11y.switchToLightMode")}
    >
      <ToggleIcon className="size-5" />
    </Button>
  );
}
