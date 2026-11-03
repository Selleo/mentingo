import { CalendarClock, Eye, FileText, Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { CompetenciesPersonAvatar } from "./CompetenciesPersonAvatar";

import type { CompetenciesReviewModel } from "../hooks/competencies-hook-models.types";

type CompetenciesReviewDetailsProps = Pick<
  CompetenciesReviewModel,
  | "download"
  | "decision"
  | "setSelectedId"
  | "subjectName"
  | "conditionsFor"
  | "statusVariant"
  | "decisionsFor"
  | "openDecision"
  | "selected"
  | "onSubject"
>;

export function CompetenciesReviewDetails({
  download,
  decision,
  setSelectedId,
  subjectName,
  conditionsFor,
  statusVariant,
  decisionsFor,
  openDecision,
  selected,
  onSubject,
}: CompetenciesReviewDetailsProps) {
  const { t, i18n } = useTranslation();
  return (
    <Dialog
      open={Boolean(selected) && !decision}
      onOpenChange={(open) => {
        if (!open) setSelectedId(null);
      }}
    >
      {selected && (
        <DialogContent
          className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0"
          aria-describedby={undefined}
        >
          <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 py-5 text-left">
            <div className="flex items-center gap-3 pr-6">
              <CompetenciesPersonAvatar
                name={subjectName(selected)}
                profilePictureUrl={selected.subjectProfilePictureUrl}
              />
              <div className="min-w-0 flex-1">
                <DialogTitle>{subjectName(selected)}</DialogTitle>
                <p className="body-sm text-neutral-800">
                  {selected.competencyName} ·{" "}
                  {formatLocalizedDate(i18n.language, selected.occurredAt, "dd MMM yyyy")}
                </p>
              </div>
              <Badge variant={statusVariant(selected.status)} className="w-fit text-xs">
                {t(`competencies.status.${selected.status}`)}
              </Badge>
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-1.5">
              <span className="details-md text-neutral-700">{t("competencies.note")}</span>
              <p className="body-sm whitespace-pre-wrap break-words text-neutral-950">
                {selected.note}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="details-md text-neutral-700">
                {t("competencies.reviewCard.confirms")}
              </span>
              <ul className="flex flex-col gap-2">
                {conditionsFor(selected).map(({ condition, levelLabel }) => {
                  const Icon = condition.kind === "document" ? FileText : Eye;
                  return (
                    <li key={condition.id} className="flex items-start gap-2">
                      <Icon
                        className="mt-0.5 size-4 shrink-0 text-neutral-700"
                        aria-hidden="true"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="details-md text-primary-800">{levelLabel}</span>
                        <span className="body-sm break-words text-neutral-950">
                          {condition.description}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {(selected.attachmentId || selected.validUntil) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {selected.attachmentId && (
                  <button
                    type="button"
                    className="body-sm inline-flex items-center gap-1.5 rounded text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                    onClick={() => void download(selected.attachmentId!).catch(() => undefined)}
                  >
                    <Paperclip className="size-4" aria-hidden="true" />
                    {t("competencies.downloadEvidence")}
                  </button>
                )}
                {selected.validUntil && (
                  <span className="body-sm inline-flex items-center gap-1.5 text-neutral-800">
                    <CalendarClock className="size-4" aria-hidden="true" />
                    {t("competencies.expiresOn", {
                      date: formatLocalizedDate(i18n.language, selected.validUntil),
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-neutral-200 px-6 py-4 sm:gap-2">
            {selected.subjectName && (
              <Button
                variant="ghost"
                className="sm:mr-auto"
                onClick={() => onSubject(selected.subjectId)}
              >
                {t("competencies.viewDetails")}
              </Button>
            )}
            {decisionsFor(selected).map((status) => (
              <Button
                key={status}
                variant={status === "approved" ? "default" : "outline"}
                onClick={() => openDecision(selected, status)}
              >
                {t(`competencies.decision.${status}`)}
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
