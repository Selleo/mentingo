import { SlidersHorizontal } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { useCompetencyConditionOverride } from "../hooks/useCompetencyConditionOverride";

import type { CompetencyConditionOverrideOptions } from "../hooks/competencies-hooks.types";

export type CompetencyConditionOverrideProps = CompetencyConditionOverrideOptions;

export function CompetencyConditionOverride({
  workspace,
  subjectId,
  competency,
  condition,
}: CompetencyConditionOverrideProps) {
  const {
    confirmationOptions,
    t,
    i18n,
    open,
    setOpen,
    saveConditionOverride,
    isPending,
    history,
    status,
    setStatus,
    comment,
    setComment,
  } = useCompetencyConditionOverride({ workspace, subjectId, competency, condition });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto w-fit gap-1.5 text-xs text-neutral-700"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          {t("competencies.detailGuide.adminAction")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-2 border-b border-neutral-200 px-6 py-5 text-left">
          <DialogTitle>{t("competencies.detailGuide.adminAction")}</DialogTitle>
          <DialogDescription className="line-clamp-3">{condition.description}</DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-col" onSubmit={saveConditionOverride}>
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
            <fieldset disabled={isPending} className="space-y-2">
              <legend className="sr-only">{t("competencies.overrideStatus")}</legend>
              {confirmationOptions.map((option) => (
                <label
                  key={option.value}
                  htmlFor={`override-status-${condition.id}-${option.value}`}
                  aria-label={t(option.titleKey)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                    status === option.value && "border-primary-300 bg-primary-50",
                    status !== option.value && "border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <input
                    id={`override-status-${condition.id}-${option.value}`}
                    type="radio"
                    name={`override-status-${condition.id}`}
                    value={option.value}
                    checked={status === option.value}
                    onChange={() => setStatus(option.value)}
                    className="mt-1 size-4 shrink-0 accent-primary-700"
                  />
                  <span className="space-y-0.5">
                    <span className="body-sm-md block text-neutral-950">{t(option.titleKey)}</span>
                    <span className="details block text-neutral-700">
                      {t(option.descriptionKey)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor={`override-comment-${condition.id}`}>
                {t("competencies.detailGuide.reason")}
              </Label>
              <Textarea
                id={`override-comment-${condition.id}`}
                required
                rows={2}
                placeholder={t("competencies.detailGuide.reasonPlaceholder")}
                value={comment}
                disabled={isPending}
                onChange={(event) => setComment(event.target.value)}
              />
            </div>
            {history.length > 0 && (
              <details className="border-t border-neutral-200 pt-3">
                <summary className="cursor-pointer text-xs font-medium text-neutral-700">
                  {t("competencies.overrideHistory")}
                </summary>
                <ul className="mt-2 space-y-2 text-xs text-neutral-800">
                  {history.map((item) => {
                    const actor = workspace.people.find(
                      (person) => person.id === item.createdBy,
                    )?.name;
                    return (
                      <li key={item.id}>
                        <span className="font-medium">
                          {t(`competencies.override.${item.status}`)}
                        </span>
                        {" - "}
                        {formatLocalizedDate(i18n.language, item.createdAt)}
                        {actor && <span> - {actor}</span>}
                        <span className="block whitespace-pre-wrap">{item.comment}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-neutral-200 px-6 py-4 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              {t("competencies.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !comment.trim()} aria-busy={isPending}>
              {t("competencies.detailGuide.saveChange")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
