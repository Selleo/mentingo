import { AI_MENTOR_TYPE } from "@repo/shared";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { InlineTextDiff } from "~/components/InlineTextDiff/InlineTextDiff";

import type {
  AiMentorGeneratedDraft,
  AiMentorGenerationChange,
  AiMentorQualityFinding,
} from "./aiMentorGeneration.types";

const formatFieldName = (field: string) => {
  const words = field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const AiMentorGenerationDraftSummary = ({ draft }: { draft: AiMentorGeneratedDraft }) => {
  const { t } = useTranslation();
  const detail =
    draft.type === AI_MENTOR_TYPE.TEACHER
      ? draft.expertise || draft.taskGoal
      : draft.aiRole || draft.scenario;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="font-semibold text-neutral-950">
        {t(`adminCourseView.curriculum.lesson.aiMentorConfiguration.mode.${draft.type}.label`)}
      </p>
      {detail && <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{detail}</p>}
    </div>
  );
};

export const AiMentorGenerationFindingList = ({
  findings,
}: {
  findings: AiMentorQualityFinding[];
}) => {
  if (findings.length === 0) return null;

  return (
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {findings.map((finding, index) => (
        <li
          key={`${finding.code}-${finding.field ?? "configuration"}-${index}`}
          className="px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{finding.message}</p>
            {finding.field && (
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-neutral-600">
                {formatFieldName(finding.field)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-neutral-600">{finding.correction}</p>
        </li>
      ))}
    </ul>
  );
};

export const AiMentorGenerationChangeDisclosure = ({
  changes,
}: {
  changes: AiMentorGenerationChange[];
}) => {
  const { t } = useTranslation();
  const visibleChanges = changes.filter(
    ({ before, after }) => before !== after && (before != null || after != null),
  );

  if (visibleChanges.length === 0) return null;

  return (
    <details className="group rounded-lg border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-neutral-900 group-open:rounded-b-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.reviewExactChanges", {
            count: visibleChanges.length,
          })}
        </span>
        <ChevronDown
          className="size-4 text-neutral-500 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="divide-y border-t border-neutral-200 px-4">
        {visibleChanges.map((change, index) => (
          <section key={`${change.field}-${index}`} className="py-3">
            <p className="mb-2 text-sm font-semibold text-neutral-900">
              {formatFieldName(change.field)}
            </p>
            <InlineTextDiff before={change.before ?? ""} after={change.after ?? ""} />
          </section>
        ))}
      </div>
    </details>
  );
};
