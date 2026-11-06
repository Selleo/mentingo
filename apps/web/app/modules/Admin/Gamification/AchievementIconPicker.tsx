import { ACHIEVEMENT_ICONS, type AchievementIcon } from "@repo/shared";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { AchievementBadge } from "~/modules/Gamification/AchievementBadge";
import { ACHIEVEMENT_ICON_COMPONENTS } from "~/modules/Gamification/achievementIcons";

type AchievementIconPickerProps = {
  value: AchievementIcon;
  onChange: (icon: AchievementIcon) => void;
  levels: { badgeImageUrl: string | null }[];
  disabled?: boolean;
};

/** Icon drawn on the tier badges, with a preview of every level's badge as learners will see it. */
export function AchievementIconPicker({
  value,
  onChange,
  levels,
  disabled,
}: AchievementIconPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const SelectedIcon = ACHIEVEMENT_ICON_COMPONENTS[value];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex flex-1 flex-col gap-y-1.5">
        <Label htmlFor="achievement-icon">{t("gamification.admin.form.icon")}</Label>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              id="achievement-icon"
              type="button"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls="achievement-icon-options"
              aria-describedby="achievement-icon-hint"
              disabled={disabled}
              className="flex h-[42px] w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:max-w-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <SelectedIcon className="size-4 shrink-0" />
                <span className="truncate">{t(`gamification.admin.icons.${value}`)}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            id="achievement-icon-options"
            align="start"
            className="w-[min(92vw,24rem)] p-0"
          >
            <Command className="[&_[cmdk-input]]:outline-none">
              <CommandInput
                className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                placeholder={t("gamification.admin.form.searchIcon")}
              />
              <CommandList>
                <CommandEmpty>{t("gamification.admin.form.noIconFound")}</CommandEmpty>
                <CommandGroup>
                  {Object.values(ACHIEVEMENT_ICONS).map((icon) => {
                    const Icon = ACHIEVEMENT_ICON_COMPONENTS[icon];
                    const name = t(`gamification.admin.icons.${icon}`);

                    return (
                      <CommandItem
                        key={icon}
                        // cmdk filters on this value, so search matches the translated name.
                        value={`${name} ${icon}`}
                        onSelect={() => {
                          onChange(icon);
                          setIsOpen(false);
                        }}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{name}</span>
                        {icon === value && <Check className="size-4 text-primary-700" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p id="achievement-icon-hint" className="text-sm text-muted-foreground">
          {t("gamification.admin.form.iconHint")}
        </p>
      </div>
      <div className="flex flex-col gap-y-1.5">
        <Label>{t("gamification.admin.form.badgePreview")}</Label>
        <div className="flex items-end gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          {levels.map(({ badgeImageUrl }, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <AchievementBadge
                level={index + 1}
                icon={value}
                badgeImageUrl={badgeImageUrl}
                className="h-14"
              />
              <span className="details text-neutral-500">
                {t("gamification.level", { level: index + 1 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
