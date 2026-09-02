import { Link } from "@remix-run/react";

import { cn } from "../../lib/utils";
import { Icon } from "../Icon";
import { Button } from "../ui/button";

import type { IconName } from "~/types/shared";

type ErrorPageProps = {
  title: string;
  description?: string;
  iconName?: IconName;
  actionLabel?: string;
  to?: string;
  onAction?: () => void;
  showAction?: boolean;
  actionIcon?: IconName;
  className?: string;
  children?: React.ReactNode;
};

export default function ErrorPage({
  title,
  description,
  iconName = "Blocked",
  actionLabel,
  to,
  onAction,
  showAction = true,
  actionIcon,
  className,
  children,
}: ErrorPageProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen w-full items-center justify-center bg-primary-50 px-4 py-10",
        className,
      )}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-200/80 bg-background p-8 text-center dark:border-neutral-800 sm:p-12">
        <div className="mx-auto mb-7 flex size-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 shadow-inner dark:bg-primary-950 dark:text-primary-300">
          <Icon name={iconName} className="size-8" aria-hidden="true" />
        </div>
        <h1 className="h4 text-neutral-950 dark:text-neutral-50">{title}</h1>
        {description && (
          <p className="mx-auto mt-2 max-w-sm body-base text-neutral-600 dark:text-neutral-300">
            {description}
          </p>
        )}

        {children && <div className="mt-8 w-full">{children}</div>}

        {showAction && (
          <div className="mt-8">
            {onAction ? (
              <Button onClick={onAction} className="gap-2">
                {actionLabel}
                {actionIcon && <Icon name={actionIcon} className="size-4" aria-hidden="true" />}
              </Button>
            ) : (
              <Link to={to ?? "/"} prefetch="intent">
                <Button className="gap-2">
                  {actionLabel}
                  {actionIcon && <Icon name={actionIcon} className="size-4" aria-hidden="true" />}
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
