import { ALLOWED_LESSON_IMAGE_FILE_TYPES, type AchievementIcon } from "@repo/shared";
import { Camera, Minus } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { AchievementBadge } from "~/modules/Gamification/AchievementBadge";

type LevelBadgeFieldProps = {
  level: number;
  icon: AchievementIcon;
  badgeImageUrl: string | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onReset: () => void;
};

/**
 * Level badge picker modelled on the AI mentor avatar field: click the badge to upload a
 * replacement, and the corner button resets an uploaded badge to the level's tier.
 */
export function LevelBadgeField({
  level,
  icon,
  badgeImageUrl,
  isUploading,
  onUpload,
  onReset,
}: LevelBadgeFieldProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-y-1.5">
      <Label>{t("gamification.admin.form.badge")}</Label>
      <div className="relative h-[42px] w-[60px]">
        <button
          type="button"
          disabled={isUploading}
          aria-label={t("uploadFile.replace")}
          className={cn(
            "group relative flex h-[42px] w-[60px] items-center justify-center overflow-hidden rounded-lg border-2 border-border transition hover:ring-2 hover:ring-primary hover:ring-offset-1",
            isUploading && "opacity-60",
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <AchievementBadge
            level={level}
            icon={icon}
            badgeImageUrl={badgeImageUrl}
            className="h-8"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-neutral-950 bg-opacity-70 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
            {t("common.button.edit")}
          </span>
        </button>
        {badgeImageUrl ? (
          <button
            type="button"
            aria-label={t("gamification.admin.form.resetBadge")}
            title={t("gamification.admin.form.resetBadge")}
            className="absolute bottom-0 left-0 flex size-4 items-center justify-center rounded-full bg-primary text-contrast shadow-md hover:opacity-80"
            onClick={onReset}
          >
            <Minus className="size-4" />
          </button>
        ) : (
          <div className="pointer-events-none absolute bottom-0 left-0 flex size-4 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 shadow-md">
            <Camera className="size-3" />
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept={ALLOWED_LESSON_IMAGE_FILE_TYPES.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";

            if (file) onUpload(file);
          }}
        />
      </div>
    </div>
  );
}
