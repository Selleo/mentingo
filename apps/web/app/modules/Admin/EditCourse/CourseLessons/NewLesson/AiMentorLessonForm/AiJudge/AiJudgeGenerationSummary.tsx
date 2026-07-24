import { AI_JUDGE_DRAFT_CHANGE_FIELD } from "@repo/shared";
import { Check, ChevronDown, Circle, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { InlineTextDiff } from "~/components/InlineTextDiff/InlineTextDiff";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { AI_JUDGE_GENERATION_CHECK_STATUS } from "./aiJudgeConfiguration.types";
import {
  formatChangeValue,
  formatTaskGoalSummary,
  getChangeFieldLabelKey,
  groupChangesByTarget,
  groupChecksByTarget,
  hasVisibleChange,
  isCriterionTargetReference,
  isInternalTargetReference,
  shouldShowChangeFieldLabel,
} from "./AiJudgeGenerationSummary.utils";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationCheck,
  AiJudgeGenerationChange,
} from "./aiJudgeConfiguration.types";

const INITIAL_VISIBLE_ITEMS = 4;

type AiJudgeGenerationTargetHeaderProps = Pick<
  AiJudgeGenerationCheck,
  "targetLabel" | "targetRef" | "targetScore" | "targetTypeLabel"
> & {
  showTargetLabel?: boolean;
  compact?: boolean;
};

const AiJudgeGenerationTargetHeader = ({
  targetRef,
  targetScore,
  targetTypeLabel,
  targetLabel,
  showTargetLabel = true,
  compact = false,
}: AiJudgeGenerationTargetHeaderProps) => {
  const { t } = useTranslation();
  const showInlineCriterionLabel =
    showTargetLabel && Boolean(targetLabel) && isCriterionTargetReference(targetRef);

  if (!targetTypeLabel && (!showTargetLabel || !targetLabel)) return null;

  return (
    <header className={compact ? "mb-2" : "mb-3"}>
      <div className="flex flex-wrap items-center gap-2">
        {targetTypeLabel && (
          <p className={cn("font-semibold text-neutral-950", compact ? "text-sm" : "text-base")}>
            {targetTypeLabel}
          </p>
        )}
        {targetScore !== undefined && (
          <span className="text-xs font-medium text-neutral-500">
            {t("adminCourseView.curriculum.lesson.aiJudge.scoreBadge", {
              score: targetScore,
            })}
          </span>
        )}
        {showInlineCriterionLabel && (
          <>
            <span className="text-neutral-300" aria-hidden>
              -
            </span>
            <p className="text-sm font-medium text-neutral-700">{targetLabel}</p>
          </>
        )}
        {isInternalTargetReference(targetRef) && (
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-neutral-600">
            {targetRef}
          </span>
        )}
      </div>
      {showTargetLabel && targetLabel && !showInlineCriterionLabel && (
        <p className="mt-1 text-sm leading-5 text-neutral-600">{targetLabel}</p>
      )}
    </header>
  );
};

export const AiJudgeGenerationChangeList = ({
  changes,
  title,
  showTitle = true,
}: {
  changes: AiJudgeGenerationChange[];
  title?: string;
  showTitle?: boolean;
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const visibleChanges = changes.filter(hasVisibleChange);
  if (visibleChanges.length === 0) return null;

  const groupedChanges = groupChangesByTarget(visibleChanges);
  const visibleGroups = expanded ? groupedChanges : groupedChanges.slice(0, INITIAL_VISIBLE_ITEMS);
  const hiddenChangeCount = groupedChanges.length - INITIAL_VISIBLE_ITEMS;

  return (
    <section>
      {showTitle && (
        <p className="mb-2 text-sm font-semibold text-neutral-900">
          {title ?? t("adminCourseView.curriculum.lesson.aiJudge.generation.changedInRevision")}
        </p>
      )}
      <div className="divide-y divide-neutral-200">
        {visibleGroups.map((group) => {
          const target = group[0];
          const includesCriterionTitle = group.some(
            ({ field }) =>
              field === AI_JUDGE_DRAFT_CHANGE_FIELD.CRITERION ||
              field === AI_JUDGE_DRAFT_CHANGE_FIELD.TITLE,
          );
          return (
            <section key={target.targetRef} className="py-3 first:pt-0 last:pb-0">
              <AiJudgeGenerationTargetHeader
                targetRef={target.targetRef}
                targetTypeLabel={target.targetTypeLabel}
                targetLabel={target.targetLabel}
                showTargetLabel={!target.targetRef.startsWith("B") && !includesCriterionTitle}
              />
              <ul className="divide-y divide-neutral-200">
                {group.map((change, index) => (
                  <li
                    key={`${change.field}-${change.score ?? "none"}-${index}`}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    {shouldShowChangeFieldLabel(change) && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900">
                          {t(getChangeFieldLabelKey(change))}
                        </p>
                        {change.score !== undefined && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                            {t("adminCourseView.curriculum.lesson.aiJudge.scoreBadge", {
                              score: change.score,
                            })}
                          </span>
                        )}
                      </div>
                    )}
                    <InlineTextDiff
                      before={formatChangeValue(change.before)}
                      after={formatChangeValue(change.after)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {hiddenChangeCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 px-2"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t("adminCourseView.curriculum.lesson.aiJudge.generation.showFewerChanges")
            : t("adminCourseView.curriculum.lesson.aiJudge.generation.showMoreChanges", {
                count: hiddenChangeCount,
              })}
        </Button>
      )}
    </section>
  );
};

export const AiJudgeGenerationChangeDisclosure = ({
  changes,
}: {
  changes: AiJudgeGenerationChange[];
}) => {
  const { t } = useTranslation();

  const visibleChanges = changes.filter(hasVisibleChange);
  if (visibleChanges.length === 0) return null;

  return (
    <details className="group rounded-lg border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-neutral-900 group-open:rounded-b-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.reviewExactChanges", {
            count: visibleChanges.length,
          })}
        </span>
        <ChevronDown className="size-4 text-neutral-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-neutral-200 px-4 pb-4 pt-3">
        <p className="mb-3 text-sm leading-5 text-neutral-600">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.exactChangesDescription")}
        </p>
        <AiJudgeGenerationChangeList changes={visibleChanges} showTitle={false} />
      </div>
    </details>
  );
};

const AiJudgeGenerationFinding = ({ check }: { check: AiJudgeGenerationCheck }) => {
  return <p className="py-1 text-sm leading-5 text-neutral-700">{check.detail ?? check.label}</p>;
};

export const AiJudgeGenerationFindingList = ({ checks }: { checks: AiJudgeGenerationCheck[] }) => {
  const groups = groupChecksByTarget(checks);

  return (
    <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {groups.map((group) => {
        const target = group[0];
        const groupKey = target.targetRef ?? target.targetTypeLabel ?? target.id;
        return (
          <section key={groupKey} className="px-4 py-3">
            <AiJudgeGenerationTargetHeader
              targetRef={target.targetRef}
              targetScore={target.targetScore}
              targetTypeLabel={target.targetTypeLabel}
              targetLabel={target.targetLabel}
              showTargetLabel
              compact
            />
            <div className="divide-y divide-neutral-100">
              {group.map((check) => (
                <AiJudgeGenerationFinding key={check.id} check={check} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const AiJudgeGenerationCheckRow = ({ check }: { check: AiJudgeGenerationCheck }) => {
  const icon = (() => {
    switch (check.status) {
      case AI_JUDGE_GENERATION_CHECK_STATUS.PASSED:
        return <Check className="size-4 text-success-700" aria-hidden />;
      case AI_JUDGE_GENERATION_CHECK_STATUS.IN_PROGRESS:
        return <LoaderCircle className="size-4 animate-spin text-primary-700" aria-hidden />;
      case AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION:
        return <span className="size-2 rounded-full bg-neutral-900" aria-hidden />;
      case AI_JUDGE_GENERATION_CHECK_STATUS.PENDING:
        return <Circle className="size-4 text-neutral-400" aria-hidden />;
    }
  })();

  return (
    <li className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{check.label}</p>
        {check.detail && <p className="mt-1 text-sm leading-5 text-neutral-600">{check.detail}</p>}
      </div>
    </li>
  );
};

export const AiJudgeGenerationCheckList = ({ checks }: { checks: AiJudgeGenerationCheck[] }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visibleChecks = expanded ? checks : checks.slice(0, INITIAL_VISIBLE_ITEMS);
  const hiddenCheckCount = checks.length - INITIAL_VISIBLE_ITEMS;

  return (
    <div>
      <ul className="grid gap-2">
        {visibleChecks.map((check) => (
          <AiJudgeGenerationCheckRow key={check.id} check={check} />
        ))}
      </ul>
      {hiddenCheckCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("mt-2 px-2", { "text-neutral-700": !expanded })}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t("adminCourseView.curriculum.lesson.aiJudge.generation.showFewerFindings")
            : t("adminCourseView.curriculum.lesson.aiJudge.generation.showMoreFindings", {
                count: hiddenCheckCount,
              })}
        </Button>
      )}
    </div>
  );
};

export const AiJudgeGenerationDraftSummary = ({ draft }: { draft: AiJudgeConfigurationDraft }) => {
  const { t } = useTranslation();
  const totalScore = draft.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="min-w-0">
        <p className="font-semibold text-neutral-950">{formatTaskGoalSummary(draft.taskGoal)}</p>
        <p className="mt-1 text-sm text-neutral-600">
          {t("adminCourseView.curriculum.lesson.aiJudge.generation.draftSummary", {
            criteria: draft.criteria.length,
            score: totalScore,
            threshold: draft.passingThresholdPercent,
            blockingErrors: draft.blockingErrors.length,
          })}
        </p>
      </div>
    </div>
  );
};
