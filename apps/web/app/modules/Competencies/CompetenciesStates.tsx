import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

import type { ReactNode } from "react";

export function CompetenciesLoading({ label }: { label: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function CompetenciesError({
  title,
  actionLabel,
  onRetry,
}: {
  title: string;
  actionLabel: string;
  onRetry: () => void;
}) {
  return (
    <ErrorPage
      title={title}
      actionLabel={actionLabel}
      onAction={onRetry}
      className="min-h-[50vh]"
    />
  );
}

export function CompetenciesEmpty({
  message,
  title,
  action,
}: {
  message: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed bg-neutral-50 px-6 py-12 text-center text-sm leading-relaxed text-muted-foreground shadow-none">
      {title && <h3 className="body-base-md text-neutral-950">{title}</h3>}
      <p className="max-w-md">{message}</p>
      {action}
    </Card>
  );
}
