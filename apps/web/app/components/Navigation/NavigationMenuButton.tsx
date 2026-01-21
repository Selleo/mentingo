import { Icon } from "~/components/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { IconName } from "~/types/shared";

type NavigationMenuButtonProps = {
  item: {
    iconName: IconName;
    label: string;
  };
  onClick: () => void;
  wrapperClassName?: string;
  className?: string;
  labelClassName?: string;
  hideLabel?: boolean;
  showTooltip?: boolean;
};

export function NavigationMenuButton({
  item,
  onClick,
  wrapperClassName,
  className,
  labelClassName,
  hideLabel = false,
  showTooltip = false,
}: NavigationMenuButtonProps) {
  return (
    <li key={item.label} className={wrapperClassName}>
      <Tooltip>
        <TooltipTrigger className="w-full">
          <button
            onClick={onClick}
            className={cn(
              "flex w-full items-center gap-x-3 rounded-lg bg-white px-4 py-3.5 text-neutral-900 hover:bg-primary-700 hover:text-white 2xl:p-2",
              className,
            )}
          >
            <Icon name={item.iconName} className="size-6" />
            <span
              className={cn("capitalize", labelClassName, {
                "sr-only": hideLabel,
              })}
            >
              {item.label}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className={cn("bg-neutral-950 capitalize text-white", {
            hidden: !showTooltip,
          })}
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
