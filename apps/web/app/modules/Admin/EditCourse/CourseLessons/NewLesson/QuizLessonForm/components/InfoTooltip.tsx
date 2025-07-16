import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipArrow,
} from "@radix-ui/react-tooltip";

import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type InfoTooltipProps = {
  message: string;
  children?: ReactNode;
  iconClassName?: string;
  showIcon?: boolean;
};

export const InfoTooltip = ({
  message,
  iconClassName = "size-4",
  children = null,
}: InfoTooltipProps) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        {children ?? (
          <span>
            <Icon name="Info" className={cn("cursor-default text-neutral-800", iconClassName)} />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
      >
        {message}
        <TooltipArrow className="fill-black" />
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
