import { ACHIEVEMENT_ICONS, type AchievementIcon } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
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

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex flex-1 flex-col gap-y-1.5">
        <Label id="achievement-icon-label">{t("gamification.admin.form.icon")}</Label>
        <div
          role="radiogroup"
          aria-labelledby="achievement-icon-label"
          aria-describedby="achievement-icon-hint"
          className="flex flex-wrap gap-1.5"
        >
          {Object.values(ACHIEVEMENT_ICONS).map((icon) => {
            const Icon = ACHIEVEMENT_ICON_COMPONENTS[icon];
            const isSelected = value === icon;

            return (
              <button
                key={icon}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={t(`gamification.admin.icons.${icon}`)}
                title={t(`gamification.admin.icons.${icon}`)}
                disabled={disabled}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-700 transition hover:border-primary-500 hover:text-primary-700 disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "border-primary-500 bg-primary-50 text-primary-700",
                )}
                onClick={() => onChange(icon)}
              >
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
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
