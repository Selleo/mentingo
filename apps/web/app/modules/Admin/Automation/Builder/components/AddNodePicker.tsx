import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import { ACTION_DEFINITIONS } from "../automationBuilder.types";

import { BLOCK_ICON_MAP } from "./automationIcons";

import type { AutomationStepDefinition } from "../automationBuilder.types";
import type { FC, ReactNode } from "react";

interface AddNodePickerProps {
  onSelect: (definition: AutomationStepDefinition) => void;
  trigger: ReactNode;
}

export const AddNodePicker: FC<AddNodePickerProps> = ({ onSelect, trigger }) => {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" side="right" sideOffset={8}>
        <div>
          <Badge variant="successFilled" className="mb-1.5 text-xs">
            {t("automationBuilder.sidebar.actions")}
          </Badge>
          <div className="space-y-0.5">
            {ACTION_DEFINITIONS.map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => onSelect(def)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  "hover:bg-emerald-50",
                )}
              >
                <span className="flex size-6 items-center justify-center rounded bg-emerald-100 text-emerald-600">
                  {BLOCK_ICON_MAP[def.icon]}
                </span>
                <span className="font-medium">{t(def.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
