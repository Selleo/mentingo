import { Button } from "~/components/ui/button";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { StageActionButtonProps } from "./LiveTrainingSessionStage.types";

export function StageActionButton({
  icon,
  label,
  variant = "secondary",
  disabled,
  testId,
  onClick,
}: StageActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant === "primary" ? "default" : "outline"}
          aria-label={label}
          data-testid={testId}
          disabled={disabled}
          onClick={onClick}
          className={cn("h-8 w-8 gap-2 px-0 sm:h-9 sm:w-auto sm:px-3", {
            "bg-white text-neutral-950 hover:bg-white/90": variant === "primary",
            "border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white":
              variant === "secondary",
          })}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        className="rounded bg-black px-2 py-1 text-sm text-white shadow-md sm:hidden"
      >
        {label}
        <TooltipArrow className="fill-black" />
      </TooltipContent>
    </Tooltip>
  );
}
