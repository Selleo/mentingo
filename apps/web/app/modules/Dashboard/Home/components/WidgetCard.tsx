import { cn } from "~/lib/utils";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type WidgetCardProps = {
  children: ReactNode;
  className?: string;
};

type DashboardWidgetHeaderProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  iconClassName?: string;
  iconContainerClassName?: string;
};

type DashboardWidgetIconProps = {
  icon: LucideIcon;
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

export function DashboardWidgetCard({ children, className }: WidgetCardProps) {
  return (
    <article
      className={cn(
        "flex h-full sm:max-h-[27rem] flex-col overflow-hidden rounded-lg bg-white drop-shadow-card",
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
        "flex size-10 shrink-0 items-center justify-center rounded-lg text-primary-700 bg-primary-50",
        iconContainerClassName,
      )}
    >
      <Icon className={cn("size-5", iconClassName)} aria-hidden="true" />
    </div>
  );
}

export function DashboardWidgetHeader({
  title,
  description,
  icon,
  iconClassName,
  iconContainerClassName,
}: DashboardWidgetHeaderProps) {
  return (
    <header className="flex min-w-0 items-center gap-3 px-5 py-5 md:px-6 md:py-6">
      <DashboardWidgetIcon
        icon={icon}
        iconClassName={iconClassName}
        iconContainerClassName={iconContainerClassName}
      />
      <div className="min-w-0">
        <h2 className="body-lg-md truncate text-neutral-950">{title}</h2>
        {description && <p className="details truncate text-neutral-500">{description}</p>}
      </div>
    </header>
  );
}

export function DashboardWidgetContent({ children, className }: DashboardWidgetCardProps) {
  return (
    <div
      className={cn(
        "body-sm min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-neutral-700 md:px-6 md:pb-6",
        className,
      )}
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
