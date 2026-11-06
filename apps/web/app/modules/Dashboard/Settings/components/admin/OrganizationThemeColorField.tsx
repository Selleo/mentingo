import { CircleAlert, CircleCheck, RotateCcw } from "lucide-react";
import { HexColorInput } from "react-colorful";
import { useTranslation } from "react-i18next";

import { ColorPickerField } from "~/components/ColorPickerField";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { MIN_TEXT_CONTRAST } from "~/modules/Theme/theme.constants";

type OrganizationThemeColorFieldProps = {
  label: string;
  description: string;
  color: string;
  inputId: string;
  inputTestId: string;
  onChange: (color: string) => void;
  contrastRatio?: number;
  automaticColor?: {
    isAutomatic: boolean;
    resetTestId: string;
    onResetToAutomatic: () => void;
  };
};

export const OrganizationThemeColorField = ({
  label,
  description,
  color,
  inputId,
  inputTestId,
  onChange,
  contrastRatio,
  automaticColor,
}: OrganizationThemeColorFieldProps) => {
  const { t } = useTranslation();

  const isReadable = contrastRatio === undefined || contrastRatio >= MIN_TEXT_CONTRAST;

  return (
    <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("organizationTheme.pickColor", { label })}
            className="size-10 shrink-0 rounded-lg border border-neutral-200 shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: color }}
          />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="center" sideOffset={8} className="w-auto p-3">
          <ColorPickerField color={color} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <Label htmlFor={inputId} className="body-sm-md text-neutral-950">
            {label}
          </Label>
          {automaticColor?.isAutomatic && (
            <span className="details-md rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
              {t("organizationTheme.automatic")}
            </span>
          )}
          {automaticColor && !automaticColor.isAutomatic && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="gap-1 px-2"
              data-testid={automaticColor.resetTestId}
              onClick={automaticColor.onResetToAutomatic}
            >
              <RotateCcw className="size-3" aria-hidden />
              {t("organizationTheme.resetToAutomatic")}
            </Button>
          )}
        </div>
        <span className={cn("body-sm text-neutral-600", { "text-error-700": !isReadable })}>
          {isReadable
            ? description
            : t("organizationTheme.lowContrast", { minimum: MIN_TEXT_CONTRAST })}
        </span>
      </div>
      {contrastRatio !== undefined && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "details-md inline-flex cursor-help items-center gap-1 rounded-full px-2 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  {
                    "bg-success-50 text-success-700": isReadable,
                    "bg-error-50 text-error-700": !isReadable,
                  },
                )}
              >
                {isReadable && <CircleCheck className="size-3.5" aria-hidden />}
                {!isReadable && <CircleAlert className="size-3.5" aria-hidden />}
                {contrastRatio.toFixed(1)}:1
              </button>
            </TooltipTrigger>
            <TooltipContent variant="black">
              {isReadable
                ? t("organizationTheme.contrastTooltip.passes", { minimum: MIN_TEXT_CONTRAST })
                : t("organizationTheme.contrastTooltip.fails", { minimum: MIN_TEXT_CONTRAST })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <div className="relative w-28 shrink-0">
        <span className="body-sm pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500">
          #
        </span>
        <HexColorInput
          id={inputId}
          color={color}
          onChange={onChange}
          data-testid={inputTestId}
          className="body-sm h-9 w-full rounded-lg border border-neutral-300 bg-white pl-6 pr-2 text-neutral-950 focus-visible:border-primary-500 focus-visible:outline-none"
        />
      </div>
    </div>
  );
};
