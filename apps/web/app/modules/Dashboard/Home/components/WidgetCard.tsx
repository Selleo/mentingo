import { Info, UserRound, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { useDashboardEditMode } from "../dashboardEditContext";
import { DashboardWidgetDataScope, type DashboardWidgetIconComponent } from "../types";

import type { ReactNode } from "react";

type WidgetCardProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

type DashboardWidgetHeaderProps = {
  title: string;
  titleBadge?: ReactNode;
  description?: string;
  icon: DashboardWidgetIconComponent;
  showIcon?: boolean;
  iconClassName?: string;
  iconContainerClassName?: string;
  headerAction?: ReactNode;
  info?: string;
  dataScope?: DashboardWidgetDataScope;
};

type DashboardWidgetIconProps = {
  icon: DashboardWidgetIconComponent;
  iconClassName?: string;
  iconContainerClassName?: string;
};

type DashboardWidgetCardProps = {
  children: ReactNode;
  className?: string;
};

type DashboardWidgetFooterProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardWidgetCard({ children, className, testId }: WidgetCardProps) {
  return (
    <article
      data-testid={testId}
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-white drop-shadow-card",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function DashboardWidgetIcon({
  icon: Icon,
  iconClassName,
  iconContainerClassName,
}: DashboardWidgetIconProps) {
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center text-primary-700",
        iconContainerClassName,
      )}
    >
      <Icon
        className={cn("size-[18px] text-primary-700", iconClassName)}
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </div>
  );
}

export function DashboardWidgetHeader({
  title,
  titleBadge,
  description,
  icon,
  showIcon = true,
  iconClassName,
  iconContainerClassName,
  headerAction,
  info,
  dataScope,
}: DashboardWidgetHeaderProps) {
  const { t } = useTranslation();
  const isEditing = useDashboardEditMode();
  const ScopeIcon = dataScope === DashboardWidgetDataScope.PERSONAL ? UserRound : UsersRound;
  const scopeLabel = dataScope ? t(`dashboardHome.widgets.dataScope.${dataScope}`) : undefined;
  const scopeTooltip = dataScope
    ? t(`dashboardHome.widgets.dataScope.${dataScope}Tooltip`)
    : undefined;

  return (
    <header className="flex min-h-14 items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
      {showIcon && (
        <DashboardWidgetIcon
          icon={icon}
          iconClassName={iconClassName}
          iconContainerClassName={iconContainerClassName}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="body-sm-md min-w-0 truncate text-neutral-950">{title}</h2>
          {titleBadge}
          {dataScope && scopeLabel && scopeTooltip && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={scopeLabel}
                    title={scopeLabel}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1"
                  >
                    <ScopeIcon className="size-3.5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                >
                  {scopeTooltip}
                  <TooltipArrow className="fill-black" />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {info && (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={info}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-1"
                  >
                    <Info className="size-3.5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                >
                  <p>{info}</p>
                  <TooltipArrow className="fill-black" />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {description && <p className="details truncate text-neutral-500">{description}</p>}
      </div>
      {headerAction && !isEditing && (
        <div className="flex shrink-0 items-center">{headerAction}</div>
      )}
    </header>
  );
}

export function DashboardWidgetContent({ children, className }: DashboardWidgetCardProps) {
  return (
    <div
      className={cn("body-sm min-h-0 w-full flex-1 overflow-y-auto text-neutral-700", className)}
    >
      {children}
    </div>
  );
}

export function DashboardWidgetFooter({ children, className }: DashboardWidgetFooterProps) {
  return (
    <footer
      className={cn(
        "details shrink-0 border-t border-neutral-100 px-5 py-3 text-neutral-500 md:px-6",
        className,
      )}
    >
      {children}
    </footer>
  );
}
