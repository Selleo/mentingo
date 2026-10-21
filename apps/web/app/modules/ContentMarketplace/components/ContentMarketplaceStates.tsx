import { useTranslation } from "react-i18next";

import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { Skeleton } from "~/components/ui/skeleton";

import type { ReactNode } from "react";

export function ContentMarketplaceLoading() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{t("contentMarketplace.loading")}</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function ContentMarketplaceError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <ErrorPage
      title={t("contentMarketplace.serviceError")}
      actionLabel={t("contentMarketplace.retry")}
      onAction={onRetry}
      className="min-h-[50vh]"
    />
  );
}

export function ContentMarketplaceEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-neutral-50 px-5 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function ContentMarketplaceHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h4 className="h4 break-words">{title}</h4>
        {description && <p className="mt-2 text-sm text-neutral-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
