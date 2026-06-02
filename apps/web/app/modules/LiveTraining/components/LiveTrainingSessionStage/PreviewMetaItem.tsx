import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { PreviewMetaItemProps } from "./LiveTrainingSessionStage.types";

export function PreviewMetaItem({
  icon,
  value,
  tooltip,
  canEdit,
  variant = "default",
}: PreviewMetaItemProps) {
  const isDanger = variant === "danger";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-8 max-w-[78vw] shrink-0 items-center gap-2 rounded border border-white/15 bg-white/10 px-2.5 text-xs text-white/85 sm:h-9 sm:max-w-none sm:px-3 sm:text-sm",
            {
              "border-danger-300/60 bg-danger-500/20 text-danger-50": isDanger,
              "transition-colors hover:border-dotted hover:border-white/60 hover:bg-white/15 group-focus-visible:border-solid group-focus-visible:border-white/75":
                canEdit && !isDanger,
              "transition-colors hover:border-dotted hover:border-danger-200/80 hover:bg-danger-500/30 group-focus-visible:border-solid group-focus-visible:border-danger-100":
                canEdit && isDanger,
            },
          )}
        >
          {icon && (
            <span className={cn("text-white/65", { "text-danger-100": isDanger })}>{icon}</span>
          )}
          <span className="min-w-0 truncate">{value}</span>
        </span>
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
  );
}
