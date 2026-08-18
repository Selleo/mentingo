import { cn } from "~/lib/utils";

import { useDashboardEditMode } from "../dashboardEditContext";

import type { DashboardWidgetIconComponent } from "../types";
import type { ReactNode } from "react";

type WidgetCardProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

type DashboardWidgetHeaderProps = {
  title: string;
  description?: string;
  icon: DashboardWidgetIconComponent;
  showIcon?: boolean;
  iconClassName?: string;
  iconContainerClassName?: string;
  headerAction?: ReactNode;
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
  description,
  icon,
  showIcon = true,
  iconClassName,
  iconContainerClassName,
  headerAction,
}: DashboardWidgetHeaderProps) {
  const isEditing = useDashboardEditMode();

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
        <h2 className="body-sm-md truncate text-neutral-950">{title}</h2>
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
