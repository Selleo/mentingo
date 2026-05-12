import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

type ReactionButtonProps = {
  reaction: string;
  count?: number;
  reactedByCurrentUser?: boolean;
  disabled: boolean;
  tooltip: string;
  compact?: boolean;
  onClick: () => void;
};

export function ReactionButton({
  reaction,
  count,
  reactedByCurrentUser,
  disabled,
  tooltip,
  compact = false,
  onClick,
}: ReactionButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={tooltip}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full border border-neutral-200 bg-background text-[11px] leading-none text-neutral-700 shadow-sm transition hover:border-primary-200 hover:bg-primary-50",
              {
                "w-6 justify-center p-0": compact,
                "px-1.5": !compact,
                "border-primary-300 bg-primary-50 text-primary-700": reactedByCurrentUser,
              },
            )}
            disabled={disabled}
            onClick={onClick}
          >
            <span aria-hidden className="text-[12px] leading-none">
              {reaction}
            </span>
            {Boolean(count) && <span className="leading-none">{count}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
