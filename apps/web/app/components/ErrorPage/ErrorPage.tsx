import { Link } from "@remix-run/react";

import { cn } from "../../lib/utils";
import { Icon } from "../Icon";
import { Button } from "../ui/button";

type ErrorPageProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  to?: string;
  onAction?: () => void;
  showAction?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export default function ErrorPage({
  title,
  description,
  actionLabel,
  to,
  onAction,
  showAction = true,
  className,
  children,
}: ErrorPageProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-primary-50/40 to-white dark:from-neutral-900 dark:to-neutral-950",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[28rem] w-[28rem] rounded-full bg-primary-100/30 blur-3xl dark:bg-primary-900/20" />
      </div>

      <div className="relative flex size-96 flex-col items-center justify-center rounded-full border border-neutral-200 bg-white/80 p-10 text-center shadow-xl backdrop-blur-md dark:border-neutral-800 bg-background">
        <Icon name="Blocked" className="size-10 mb-6 text-primary-700" />
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
        {description ? (
          <p className="mt-3 px-4 text-sm text-neutral-600 dark:text-neutral-300">{description}</p>
        ) : null}

        {children ? <div className="mt-3 w-full px-4">{children}</div> : null}

        {showAction ? (
          <div className="mt-6">
            {onAction ? (
              <Button onClick={onAction}>{actionLabel}</Button>
            ) : (
              <Link to={to ?? "/"} prefetch="intent">
                <Button>{actionLabel}</Button>
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
