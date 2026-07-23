import { Check, ChevronDown, CircleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { AiJudgeGenerationChangeList } from "./AiJudgeGenerationSummary";

import type { AiJudgeGenerationAttempt } from "./aiJudgeConfiguration.types";

const AiJudgeGenerationAttemptDetails = ({
  attempt,
  initiallyOpen,
}: {
  attempt: AiJudgeGenerationAttempt;
  initiallyOpen: boolean;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group border-b border-neutral-200 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span
          className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", {
            "bg-success-50 text-success-700": attempt.passed,
            "bg-warning-50 text-warning-700": !attempt.passed,
          })}
        >
          {attempt.passed && <Check className="size-4" aria-hidden />}
          {!attempt.passed && <CircleAlert className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900">
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.attemptNumber", {
              attempt: attempt.attempt,
            })}
          </p>
          <p className="text-xs text-neutral-500">
            {t(
              attempt.passed
                ? "adminCourseView.curriculum.lesson.aiJudge.generation.attemptPassed"
                : "adminCourseView.curriculum.lesson.aiJudge.generation.attemptNeedsRevision",
            )}
          </p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 pb-4 pl-9">
        {attempt.changes.length === 0 && (
          <p className="text-sm text-neutral-500">
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.initialDraftCreated")}
          </p>
        )}
        <AiJudgeGenerationChangeList
          changes={attempt.changes}
          title={t("adminCourseView.curriculum.lesson.aiJudge.generation.changesInAttempt")}
        />

        <div className="border-t border-neutral-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t("adminCourseView.curriculum.lesson.aiJudge.generation.qualityFeedback")}
          </p>
          <p className="mt-1 text-sm text-neutral-700">{attempt.summary}</p>
          {attempt.corrections.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600">
              {attempt.corrections.map((correction) => (
                <li key={correction}>{correction}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
};

export const AiJudgeGenerationAttemptHistory = ({
  attempts,
  collapsed = false,
}: {
  attempts: AiJudgeGenerationAttempt[];
  collapsed?: boolean;
}) => {
  const { t } = useTranslation();

  if (attempts.length === 0) return null;

  const attemptRows = attempts.map((attempt, index) => (
    <AiJudgeGenerationAttemptDetails
      key={attempt.attempt}
      attempt={attempt}
      initiallyOpen={!collapsed && index === attempts.length - 1}
    />
  ));

  const history = (
    <section>
      <h3 className="text-sm font-semibold text-neutral-900">
        {t("adminCourseView.curriculum.lesson.aiJudge.generation.attemptHistory")}
      </h3>
      <div className="mt-2 border-y border-neutral-200">{attemptRows}</div>
    </section>
  );

  if (!collapsed) return history;

  return (
    <details className="group overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-neutral-900">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.attemptHistory")}
        </span>
        <span className="text-neutral-400">·</span>
        <span className="flex-1 text-neutral-600">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.viewDetails")}
        </span>
        <ChevronDown className="size-4 text-neutral-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-neutral-200 px-4">{attemptRows}</div>
    </details>
  );
};
