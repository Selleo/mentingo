import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { Button } from "~/components/ui/button";

export function HelpdeskLoading() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("helpdesk.loading")} className="space-y-4 p-5">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex animate-pulse gap-3" aria-hidden>
          <div className="size-12 shrink-0 rounded-lg bg-neutral-100" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-3/4 rounded bg-neutral-100" />
            <div className="h-3 w-full rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HelpdeskRequestError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="px-5 py-6 text-center">
      <p className="body-sm text-neutral-700">
        {getTranslatedApiErrorMessage(error, t, t("helpdesk.errors.unavailable"), {
          allowUntranslatedMessage: false,
        })}
      </p>
      <Button className="mt-4" variant="outline" onClick={onRetry}>
        {t("helpdesk.retry")}
      </Button>
    </div>
  );
}
