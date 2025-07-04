import { type LucideProps, Moon, Sun } from "lucide-react";
import { match } from "ts-pattern";

import { useThemeStore } from "~/modules/Theme/themeStore";

import { Button, type ButtonProps } from "../ui/button";

type ThemeToggleProps = {
  variant?: ButtonProps["variant"];
  className?: string;
};

export default function ThemeToggle({ className, variant = "ghost" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();

  const ToggleIcon: React.FC<LucideProps> = (props) =>
    match(theme)
      .with("light", () => <Sun aria-label="Switch to lightmode" {...props} />)
      .with("dark", () => <Moon aria-label="Switch to darkmode" {...props} />)
      .exhaustive();

  return (
    <Button variant={variant} className={className} onClick={toggleTheme}>
      <ToggleIcon className="size-5" />
    </Button>
  );
}
