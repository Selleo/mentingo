import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";

import { CertificateValidityInput } from "./CertificateValidityInput";

import type { CertificateValidityType, CertificateValidityUnit } from "@repo/shared";

type CertificateValiditySectionProps = {
  disabled: boolean;
  isValidityEnabled: boolean;
  hasValidityChanges: boolean;
  isCheckingValidityImpact: boolean;
  isUpdatingCourseSettings: boolean;
  validityType: CertificateValidityType;
  validityValue: number;
  validityUnit: CertificateValidityUnit;
  validityDate: string;
  validityDateError: string | null;
  onValidityEnabledChange: (value: boolean) => void;
  onValidityTypeChange: (value: CertificateValidityType) => void;
  onValidityValueChange: (value: number) => void;
  onValidityUnitChange: (value: CertificateValidityUnit) => void;
  onValidityDateChange: (value: string) => void;
  onSave: () => void;
};

export function CertificateValiditySection({
  disabled,
  isValidityEnabled,
  hasValidityChanges,
  isCheckingValidityImpact,
  isUpdatingCourseSettings,
  validityType,
  validityValue,
  validityUnit,
  validityDate,
  validityDateError,
  onValidityEnabledChange,
  onValidityTypeChange,
  onValidityValueChange,
  onValidityUnitChange,
  onValidityDateChange,
  onSave,
}: CertificateValiditySectionProps) {
  const { t } = useTranslation();

  const isSaveButtonDisabled =
    disabled || !hasValidityChanges || isCheckingValidityImpact || isUpdatingCourseSettings;

  return (
    <div
      className={`flex flex-col gap-4 transition-opacity ${
        disabled ? "opacity-50" : "opacity-100"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Switch
            checked={isValidityEnabled}
            onCheckedChange={onValidityEnabledChange}
            disabled={disabled}
            aria-label={t("adminCourseView.settings.other.certificateValidity")}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-neutral-950">
              {t("adminCourseView.settings.other.certificateValidity")}
            </p>
            <p className="text-sm text-neutral-700">
              {t("adminCourseView.settings.other.certificateValidityDescription")}
            </p>
          </div>
        </div>
      </div>

      {isValidityEnabled && (
        <CertificateValidityInput
          disabled={disabled}
          validityType={validityType}
          validityValue={validityValue}
          validityUnit={validityUnit}
          validityDate={validityDate}
          validityDateError={validityDateError}
          onValidityTypeChange={onValidityTypeChange}
          onValidityValueChange={onValidityValueChange}
          onValidityUnitChange={onValidityUnitChange}
          onValidityDateChange={onValidityDateChange}
        />
      )}
      <div className="flex w-full items-center justify-end">
        <Button
          type="button"
          variant="default"
          disabled={isSaveButtonDisabled}
          className="w-fit"
          onClick={onSave}
        >
          {t("adminCourseView.settings.button.saveValidity")}
        </Button>
      </div>
    </div>
  );
}
