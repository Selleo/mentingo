import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import type { CompetencyEvidence } from "../competencies.types";
import type { CompetencySubjectModel } from "../hooks/competencies-hook-models.types";

type CompetencyConfirmationHistoryProps = Pick<CompetencySubjectModel, "download" | "isPending"> & {
  evidence: CompetencyEvidence[];
};

export function CompetencyConfirmationHistory({
  evidence,
  download,
  isPending,
}: CompetencyConfirmationHistoryProps) {
  const { t, i18n } = useTranslation();
  return (
    <details className="border-t border-neutral-200 pt-4">
      <summary className="cursor-pointer rounded text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
        {t("competencies.detailGuide.history", { count: evidence.length })}
      </summary>
      {!evidence.length && (
        <p className="mt-3 text-sm text-neutral-700">
          {t("competencies.detailGuide.emptyHistory")}
        </p>
      )}
      {evidence.map((item) => (
        <div key={item.id} className="mt-3 border-t border-neutral-200 pt-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{t(`competencies.status.${item.status}`)}</span>
            <span className="text-neutral-700">
              {formatLocalizedDate(i18n.language, item.occurredAt)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words">{item.note}</p>
          {item.validUntil && (
            <p className="mt-1 text-neutral-700">
              {t("competencies.expiresOn", {
                date: formatLocalizedDate(i18n.language, item.validUntil),
              })}
            </p>
          )}
          {item.reason && (
            <p className="mt-1 whitespace-pre-wrap text-neutral-700">{item.reason}</p>
          )}
          {item.attachmentId && (
            <Button
              variant="link"
              size="sm"
              disabled={isPending}
              onClick={() => void download(item.attachmentId!).catch(() => undefined)}
            >
              {t("competencies.downloadEvidence")}
            </Button>
          )}
        </div>
      ))}
    </details>
  );
}
