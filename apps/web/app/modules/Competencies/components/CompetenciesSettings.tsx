import { BellRing, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

const WARNING_DAY_PRESETS = [7, 14, 30, 60, 90];
const DEFAULT_WARNING_DAYS = 30;

export function CompetenciesSettings({
  currentWarningDays,
}: {
  currentWarningDays: number | null;
}) {
  const { t } = useTranslation();
  const switchId = useId();
  const customId = useId();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [enabled, setEnabled] = useState(currentWarningDays !== null);
  const [warningDays, setWarningDays] = useState(
    String(currentWarningDays ?? DEFAULT_WARNING_DAYS),
  );
  const parsedDays = Number(warningDays);
  const isValidDays = warningDays !== "" && Number.isInteger(parsedDays) && parsedDays >= 0;
  const nextValue = enabled ? parsedDays : null;
  const hasChanges = nextValue !== currentWarningDays;
  const canSave = hasChanges && (!enabled || isValidDays) && !isPending;

  return (
    <div className="min-w-0 overflow-hidden">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canSave) return;
          try {
            await execute({ operation: "settings", warningDays: nextValue });
          } catch {
            /* Preserve entered settings. */
          }
        }}
      >
        <div className="flex items-start gap-4 p-6">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-800"
          >
            <BellRing className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor={switchId} className="body-base-md text-neutral-950">
              {t("competencies.expirySettingsForm.toggleLabel")}
            </Label>
            <p className="body-sm text-neutral-800">
              {t("competencies.expirySettingsForm.toggleHelp")}
            </p>
          </div>
          <Switch id={switchId} checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {enabled && (
          <div className="flex flex-col gap-4 border-t border-neutral-200 bg-neutral-50/60 p-6">
            <div className="flex flex-col gap-2">
              <span className="body-sm-md text-neutral-950">
                {t("competencies.expirySettingsForm.warnBefore")}
              </span>
              <div
                role="radiogroup"
                aria-label={t("competencies.expirySettingsForm.warnBefore")}
                className="flex flex-wrap gap-2"
              >
                {WARNING_DAY_PRESETS.map((days) => {
                  const isActive = parsedDays === days && warningDays !== "";
                  return (
                    <button
                      key={days}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setWarningDays(String(days))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
                        isActive && "border-primary-700 bg-primary-700 text-white",
                        !isActive &&
                          "border-neutral-200 bg-white text-neutral-900 hover:border-primary-300",
                      )}
                    >
                      {t("competencies.setupSection.expiryDays", { count: days })}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={customId} className="body-sm-md">
                {t("competencies.expirySettingsForm.custom")}
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id={customId}
                  className="w-32"
                  type="number"
                  min={0}
                  step={1}
                  value={warningDays}
                  aria-invalid={!isValidDays}
                  onChange={(event) => setWarningDays(event.target.value)}
                />
                <span className="body-sm text-neutral-800">{t("competencies.expiryDaysUnit")}</span>
              </div>
            </div>
            <p
              className={cn(
                "body-sm rounded-lg border p-3",
                isValidDays && "border-primary-200 bg-primary-50 text-primary-800",
                !isValidDays && "border-error-200 bg-error-50 text-error-700",
              )}
            >
              {isValidDays
                ? t("competencies.expirySettingsForm.preview", { count: parsedDays })
                : t("competencies.expirySettingsForm.invalid")}
            </p>
          </div>
        )}
        <div className="flex justify-end border-t border-neutral-200 px-6 py-4">
          <Button type="submit" disabled={!canSave}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
            {t(isPending ? "competencies.saving" : "competencies.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
