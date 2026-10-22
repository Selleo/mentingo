import ErrorPage from "~/components/ErrorPage/ErrorPage";
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

export function CompetenciesEmpty({ message }: { message: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-neutral-50 px-5 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
