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
  disabled?: boolean;
  tooltipTranslationKey?: string;
}
export function SettingItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  icon,
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
          <Label htmlFor={id} className="body-base-md">
            {label}
          </Label>
          <p className="body-sm-md text-muted-foreground">{description}</p>
        </div>
      </div>
      {disabled ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger>
              <Switch disabled />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="center"
              className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
            >
              {t(tooltipTranslationKey)}
              <TooltipArrow className="fill-black" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      )}
    </div>
  );
}
