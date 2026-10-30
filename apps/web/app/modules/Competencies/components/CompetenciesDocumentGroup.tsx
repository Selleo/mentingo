import { ChevronDown, MessageSquareText, Paperclip, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { countBadgeClassName } from "../utils/competenciesDocuments.utils";

import type {
  Competency,
  CompetencyDocumentGroup,
  CompetencyDocumentStep,
} from "../competencies.types";
import type { CompetenciesDocumentsModel } from "../hooks/competencies-hook-models.types";

type CompetenciesDocumentGroupProps = Pick<
  CompetenciesDocumentsModel,
  "download" | "downloading" | "setSubmission" | "canSubmit" | "levelIndexOf"
> & {
  group: CompetencyDocumentGroup;
  definition: Competency;
  steps: CompetencyDocumentStep[];
  pendingCount: number;
  missingCount: number;
};

export function CompetenciesDocumentGroup({
  download,
  downloading,
  setSubmission,
  canSubmit,
  levelIndexOf,
  group,
  definition,
  steps,
  pendingCount,
  missingCount,
}: CompetenciesDocumentGroupProps) {
  const { t, i18n } = useTranslation();
  return (
    <AccordionItem
      key={definition.id}
      value={definition.id}
      data-testid={COMPETENCIES_HANDLES.DOCUMENT_GROUP(definition.id)}
    >
      <AccordionTrigger className="group gap-3 px-4 py-3 text-left hover:bg-neutral-50 [&[data-state=open]>svg]:rotate-180">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="body-sm-md truncate text-neutral-950">{definition.name}</span>
          {definition.categoryName && (
            <span className="details text-neutral-700">{definition.categoryName}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {pendingCount > 0 && (
            <span
              role="img"
              aria-label={t("competencies.documentsGroup.pending", {
                count: pendingCount,
              })}
              title={t("competencies.documentsGroup.pending", { count: pendingCount })}
              className={cn(countBadgeClassName, "bg-warning-100 text-warning-800")}
            >
              {pendingCount}
            </span>
          )}
          {missingCount > 0 && (
            <span
              role="img"
              aria-label={t("competencies.documentsGroup.toSubmit", {
                count: missingCount,
              })}
              title={t("competencies.documentsGroup.toSubmit", { count: missingCount })}
              className={cn(countBadgeClassName, "bg-primary-100 text-primary-800")}
            >
              {missingCount}
            </span>
          )}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-neutral-700 transition-transform"
          aria-hidden="true"
        />
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50/60 px-4 py-3">
        {steps.length > 0 && (
          <ol className="divide-y divide-neutral-200">
            {steps.map(({ level, condition, pending }) => (
              <li
                key={condition.id}
                data-testid={COMPETENCIES_HANDLES.DOCUMENT(definition.id, condition.id)}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0"
              >
                <span className="details-md shrink-0 rounded-md bg-white px-2 py-0.5 text-primary-800 ring-1 ring-primary-200">
                  {t("competencies.numberedLevel", {
                    number: levelIndexOf(group, level.id) + 1,
                    name: level.name,
                  })}
                </span>
                <p className="body-sm min-w-0 flex-1 basis-60 text-neutral-950">
                  {condition.description}
                </p>
                <Badge variant={pending ? "inProgress" : "notStarted"} className="text-xs">
                  {pending
                    ? t("competencies.status.pending")
                    : t("competencies.documentsGroup.notSubmitted")}
                </Badge>
                {canSubmit && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setSubmission({ competency: definition, condition })}
                  >
                    <Upload className="mr-2 size-4" aria-hidden="true" />
                    {t("competencies.evidenceAction.document")}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
        {group.submissions.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="details-md text-neutral-700">
              {t("competencies.documentSubmissions")}
            </span>
            <ul className="flex flex-col divide-y divide-neutral-200">
              {group.submissions.map((record) => (
                <li key={record.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={match(record.status)
                        .with("approved", () => "success" as const)
                        .with("pending", () => "inProgress" as const)
                        .otherwise(() => "notStarted" as const)}
                      className="text-xs"
                    >
                      {t(`competencies.status.${record.status}`)}
                    </Badge>
                    <span className="details text-neutral-700">
                      {formatLocalizedDate(i18n.language, record.occurredAt, "dd MMM yyyy")}
                    </span>
                    {record.attachmentId && (
                      <button
                        type="button"
                        disabled={downloading}
                        className="details-md ml-auto inline-flex items-center gap-1 rounded text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                        onClick={() => void download(record.attachmentId!).catch(() => undefined)}
                      >
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        {t("competencies.downloadEvidence")}
                      </button>
                    )}
                  </div>
                  <p className="body-sm line-clamp-2 whitespace-pre-wrap break-words text-neutral-950">
                    {record.note}
                  </p>
                  {record.reason && (
                    <div
                      className={cn(
                        "mt-1 flex gap-2",
                        record.status === "approved" && "text-success-700",
                        record.status !== "approved" && "text-error-700",
                      )}
                    >
                      <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="body-sm-md">
                          {t("competencies.documentsSection.reviewerReason")}
                        </span>
                        <p className="body-sm whitespace-pre-wrap break-words text-neutral-950">
                          {record.reason}
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
