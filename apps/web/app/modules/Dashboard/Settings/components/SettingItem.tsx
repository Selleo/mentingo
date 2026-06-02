import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip,
} from "~/components/ui/tooltip";

import type { ReactNode } from "react";

interface SettingItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  icon?: ReactNode;
  tooltip?: string;
  disabled?: boolean;
  tooltipTranslationKey?: string;
  testId?: string;
}
export function SettingItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  icon,
  tooltip,
  testId,
  tooltipTranslationKey = "",
  disabled = false,
}: SettingItemProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-lg">
            {icon}
          </div>
        )}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={id} className="body-base-md">
              {label}
            </Label>
            {tooltip && !disabled ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex size-4 items-center justify-center"
                      aria-label={tooltip}
                    >
                      <Info className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="center"
                    className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                  >
                    {tooltip}
                    <TooltipArrow className="fill-black" />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          <p className="body-sm-md text-muted-foreground">{description}</p>
        </div>
      </div>
      {disabled ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <Switch disabled checked={checked} data-testid={testId} />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="center"
              className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
            >
              {tooltip ?? t(tooltipTranslationKey)}
              <TooltipArrow className="fill-black" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
      )}
    </div>
  );
}
