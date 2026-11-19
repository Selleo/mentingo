import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DatePicker } from "~/components/DatePicker";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import {
  ACTIVITY_PERIOD_PRESETS,
  ROLLING_PERIOD_PRESET_DAYS,
} from "../constants/courseActivity.constants";
import { findPresetForPeriod, getRollingPeriod } from "../utils/courseActivity.utils";

import type { ActivityPeriodPreset } from "../types/courseActivity.types";
import type { ReportActivityPeriod } from "../types/reports-api.types";

type ReportActivityPeriodControlsProps = {
  period: ReportActivityPeriod;
  onPeriodChange: (period: ReportActivityPeriod) => void;
  isFetching?: boolean;
};

export function ReportActivityPeriodControls({
  period,
  onPeriodChange,
  isFetching,
}: ReportActivityPeriodControlsProps) {
  const { t } = useTranslation();
  const [selectedPreset, setSelectedPreset] = useState(() => findPresetForPeriod(period));
  const [draftPeriod, setDraftPeriod] = useState(period);
  const isDraftPeriodValid = Boolean(
    draftPeriod.from && draftPeriod.to && draftPeriod.from <= draftPeriod.to,
  );

  const selectPreset = (preset: ActivityPeriodPreset) => {
    setSelectedPreset(preset);
    if (preset === ACTIVITY_PERIOD_PRESETS.CUSTOM) return;
    const presetPeriod = getRollingPeriod(preset);
    setDraftPeriod(presetPeriod);
    onPeriodChange(presetPeriod);
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (isDraftPeriodValid) onPeriodChange(draftPeriod);
      }}
    >
      <Select
        value={selectedPreset}
        onValueChange={(preset) => selectPreset(preset as ActivityPeriodPreset)}
      >
        <SelectTrigger className="h-10 w-44" aria-label={t("reports.activity.periodLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ROLLING_PERIOD_PRESET_DAYS).map(([preset, days]) => (
            <SelectItem key={preset} value={preset}>
              {t("reports.activity.lastDays", { count: days })}
            </SelectItem>
          ))}
          <SelectItem value={ACTIVITY_PERIOD_PRESETS.CUSTOM}>
            {t("reports.activity.custom")}
          </SelectItem>
        </SelectContent>
      </Select>
      {selectedPreset === ACTIVITY_PERIOD_PRESETS.CUSTOM && (
        <>
          <DatePicker
            label={t("reports.activity.from")}
            placeholder={t("reports.filters.selectDate")}
            value={draftPeriod.from || undefined}
            maxDate={draftPeriod.to || undefined}
            className="w-44"
            onChange={(from) => setDraftPeriod((current) => ({ ...current, from: from ?? "" }))}
          />
          <DatePicker
            label={t("reports.activity.to")}
            placeholder={t("reports.filters.selectDate")}
            value={draftPeriod.to || undefined}
            minDate={draftPeriod.from || undefined}
            className="w-44"
            onChange={(to) => setDraftPeriod((current) => ({ ...current, to: to ?? "" }))}
          />
          <Button type="submit" disabled={!isDraftPeriodValid || isFetching}>
            {t("reports.activity.apply")}
          </Button>
        </>
      )}
    </form>
  );
}
