import { AlertTriangle, Award, CalendarClock, CircleX, Mail, UserPlus, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import { ACTION_DEFINITIONS, CONDITION_DEFINITIONS } from "../automationBuilder.types";

import type { AutomationStepDefinition } from "../automationBuilder.types";
import type { FC, ReactNode } from "react";

const ICON_MAP: Record<string, ReactNode> = {
  "calendar-clock": <CalendarClock className="size-4" />,
  "alert-triangle": <AlertTriangle className="size-4" />,
  "circle-x": <CircleX className="size-4" />,
  "user-plus": <UserPlus className="size-4" />,
  award: <Award className="size-4" />,
  video: <Video className="size-4" />,
  mail: <Mail className="size-4" />,
};

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
        <div className="mb-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("automationBuilder.sidebar.conditions")}
          </p>
          <div className="space-y-0.5">
            {CONDITION_DEFINITIONS.map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => onSelect(def)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  "hover:bg-blue-50",
                )}
              >
                <span className="flex size-6 items-center justify-center rounded bg-blue-100 text-blue-600">
                  {ICON_MAP[def.icon]}
                </span>
                <span className="font-medium">{t(def.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("automationBuilder.sidebar.actions")}
          </p>
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
                  {ICON_MAP[def.icon]}
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
