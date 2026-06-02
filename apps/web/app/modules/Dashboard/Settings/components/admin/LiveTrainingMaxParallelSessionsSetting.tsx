import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateLiveTrainingMaxParallelSessions } from "~/api/mutations/admin/useUpdateLiveTrainingMaxParallelSessions";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

type LiveTrainingMaxParallelSessionsSettingProps = {
  value: number;
};

export function LiveTrainingMaxParallelSessionsSetting({
  value,
}: LiveTrainingMaxParallelSessionsSettingProps) {
  const { t } = useTranslation();
  const [currentValue, setCurrentValue] = useState(String(value));
  const { mutate: updateMaxParallelSessions, isPending } =
    useUpdateLiveTrainingMaxParallelSessions();

  useEffect(() => {
    setCurrentValue(String(value));
  }, [value]);

  const parsedValue = Number(currentValue);
  const normalizedValue = Number.isNaN(parsedValue) ? value : Math.max(1, Math.floor(parsedValue));
  const isDirty = normalizedValue !== value;

  const handleSave = () => {
    updateMaxParallelSessions({ liveTrainingMaxParallelSessions: normalizedValue });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="liveTrainingMaxParallelSessions" className="body-base-md">
          {t("adminPreferences.field.liveTrainingMaxParallelSessions")}
        </Label>
        <p className="body-sm-md text-muted-foreground">
          {t("adminPreferences.field.liveTrainingMaxParallelSessionsDescription")}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:w-56">
        <Input
          id="liveTrainingMaxParallelSessions"
          type="number"
          min={1}
          step={1}
          value={currentValue}
          disabled={isPending}
          data-testid={SETTINGS_PAGE_HANDLES.LIVE_TRAINING_MAX_PARALLEL_SESSIONS_INPUT}
          onChange={(event) => setCurrentValue(event.target.value)}
          onBlur={() => setCurrentValue(String(normalizedValue))}
          className="h-9"
        />
        {isDirty ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={handleSave}
            data-testid={SETTINGS_PAGE_HANDLES.LIVE_TRAINING_MAX_PARALLEL_SESSIONS_SAVE}
          >
            {t("common.button.save")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
