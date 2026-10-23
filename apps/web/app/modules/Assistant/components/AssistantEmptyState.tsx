import { BookOpen, Search, Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";

const starters = [
  { key: "find", icon: Search },
  { key: "learn", icon: BookOpen },
  { key: "understand", icon: Lightbulb },
] as const;

export function AssistantEmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col items-center justify-center px-6 py-8 sm:px-10">
      <h2 className="text-center text-2xl font-medium tracking-tight text-foreground sm:text-[28px]">
        {t("assistant.welcome")}
      </h2>
      <div className="mt-6 flex w-full max-w-sm flex-col items-stretch gap-1">
        {starters.map(({ key, icon: StarterIcon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(t(`assistant.starters.${key}.prompt`))}
            className="group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <StarterIcon className="size-[18px] shrink-0 text-neutral-400" />
            <span className="text-sm">{t(`assistant.starters.${key}.label`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
