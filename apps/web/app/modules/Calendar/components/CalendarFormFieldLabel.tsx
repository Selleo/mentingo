import { CircleHelp } from "lucide-react";

import { Label } from "~/components/ui/label";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

type CalendarFormFieldLabelProps = {
  htmlFor?: string;
  label: string;
  tooltip: string;
};

export function CalendarFormFieldLabel({ htmlFor, label, tooltip }: CalendarFormFieldLabelProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Tooltip>
        <TooltipTrigger type="button" className="text-neutral-500 hover:text-neutral-800">
          <CircleHelp className="size-3.5" />
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
    </div>
  );
}
