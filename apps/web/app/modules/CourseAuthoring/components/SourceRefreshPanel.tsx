/** Resolves replacement-source mappings while preserving existing tasks and proposals. */
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { COURSE_AUTHORING_HANDLES } from "../../../../e2e/data/curriculum/handles";

import type {
  CourseContext,
  SourcePolicy,
  SourceRefreshCoverageImpact,
  SourceRefreshView,
  SourceView,
} from "../courseAuthoring.types";

type Props = {
  sourceRefreshes: SourceRefreshView[];
  sources: SourceView[];
  sourcePolicy: SourcePolicy | null;
  course?: CourseContext;
  disabled?: boolean;
  onRefreshSource: (
    oldSourceVersionId: string,
    replacementSourceVersionId: string,
    sourcePolicy?: SourcePolicy,
    selectedTaskIds?: string[],
  ) => void;
};

const CLEAR_MAPPING = "__clear__";

/** Shows replacement impact and requires an explicit mapping before retry. */
export const SourceRefreshPanel = ({
  sourceRefreshes,
  sources,
  sourcePolicy,
  course,
  disabled,
  onRefreshSource,
}: Props) => {
  const { t } = useTranslation();
  /** Chooses a human-readable section name and falls back to its sequence. */
  const sourceSectionLabel = (section: SourceView["sections"][number]) =>
    section.label ??
    match(section.pageNumber)
      .when(
        (pageNumber): pageNumber is number => pageNumber !== null,
        (pageNumber) => t("courseAuthoring.sourceRefresh.page", { number: pageNumber }),
      )
      .otherwise(() =>
        t("courseAuthoring.sourceRefresh.section", {
          kind: section.kind,
          number: section.sequence + 1,
        }),
      );
  const latest = sourceRefreshes[0];
  const replacement = sources.find((source) => source.id === latest?.replacementSourceVersionId);
  const selectionMatches =
    latest && sourcePolicy?.sourceVersionIds.includes(latest.oldSourceVersionId) === true;
  const unmappedSections = useMemo(
    () =>
      latest?.unmappedSectionIds.flatMap((sectionId) => {
        const kind = match({
          required: sourcePolicy?.requiredSectionIds.includes(sectionId) ?? false,
          excluded: sourcePolicy?.excludedSectionIds.includes(sectionId) ?? false,
        })
          .with({ required: true }, () => "required" as const)
          .with({ excluded: true }, () => "excluded" as const)
          .otherwise(() => null);
        return kind ? [{ sectionId, kind }] : [];
      }) ?? [],
    [latest, sourcePolicy],
  );
  const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});
  const [openMappingKey, setOpenMappingKey] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[] | null>(null);
  const refreshSelectionKey = latest?.refreshId ?? String(latest?.sequence ?? "none");

  useEffect(() => {
    setSelectedTaskIds(null);
  }, [refreshSelectionKey]);

  useEffect(() => {
    if (!openMappingKey) return;
    const previousPointerEvents = document.body.style.pointerEvents;
    const restoreTimer = window.setTimeout(() => {
      document.body.style.pointerEvents = "auto";
    }, 0);
    return () => {
      window.clearTimeout(restoreTimer);
      document.body.style.pointerEvents = previousPointerEvents;
    };
  }, [openMappingKey]);

  if (!latest) return null;

  const requiredSections = new Set(latest.suggestedSourcePolicy.requiredSectionIds);
  const excludedSections = new Set(latest.suggestedSourcePolicy.excludedSectionIds);
  for (const { sectionId, kind } of unmappedSections) {
    const selection = mappingSelections[`${latest.refreshId ?? latest.sequence}:${sectionId}`];
    if (!selection || selection === CLEAR_MAPPING) continue;
    if (kind === "required") requiredSections.add(selection);
    else excludedSections.add(selection);
  }
  const mappingConflict = [...requiredSections].some((id) => excludedSections.has(id));
  const mappingComplete =
    selectionMatches &&
    !mappingConflict &&
    unmappedSections.every(
      ({ sectionId }) => mappingSelections[`${latest.refreshId ?? latest.sequence}:${sectionId}`],
    );
  const resolvedSectionIds = new Set(
    unmappedSections.flatMap(({ sectionId }) => {
      const selection = mappingSelections[`${latest.refreshId ?? latest.sequence}:${sectionId}`];
      return selection ? [sectionId] : [];
    }),
  );
  const coverageImpacts = latest.coverageImpacts ?? [];
  const taskCanBeUpdated = (impact: SourceRefreshCoverageImpact) =>
    impact.updateEligible ||
    (impact.unmappedSectionIds.length > 0 &&
      impact.unmappedSectionIds.every((sectionId) => resolvedSectionIds.has(sectionId)) &&
      !mappingConflict);
  const selectableImpacts = coverageImpacts.filter(taskCanBeUpdated);
  const currentSelectedTaskIds = (
    selectedTaskIds ?? selectableImpacts.map((impact) => impact.taskId)
  ).filter((taskId) => selectableImpacts.some((impact) => impact.taskId === taskId));
  const mappingBlockedMessage = match({
    hasSourceAndReplacement: Boolean(sourcePolicy && replacement),
    selectionMatches,
  })
    .with({ hasSourceAndReplacement: false }, () =>
      t("courseAuthoring.sourceRefresh.mappingUnavailable"),
    )
    .with({ selectionMatches: false }, () =>
      t("courseAuthoring.errors.sourceRefreshSelectionChanged"),
    )
    .otherwise(() => null);
  /** Sends explicit required/excluded mappings only after validating conflicts. */
  const resolveMapping = () => {
    if (!sourcePolicy || !replacement || !mappingComplete) return;
    const policy: SourcePolicy = {
      ...latest.suggestedSourcePolicy,
      sourceVersionIds: latest.suggestedSourcePolicy.sourceVersionIds.length
        ? latest.suggestedSourcePolicy.sourceVersionIds
        : sourcePolicy.sourceVersionIds.map((id) =>
            id === latest.oldSourceVersionId ? latest.replacementSourceVersionId : id,
          ),
      requiredSectionIds: [...requiredSections],
      excludedSectionIds: [...excludedSections],
    };
    onRefreshSource(
      latest.oldSourceVersionId,
      latest.replacementSourceVersionId,
      policy,
      currentSelectedTaskIds,
    );
  };

  return (
    <section
      data-testid={COURSE_AUTHORING_HANDLES.SOURCE_REFRESH_PANEL}
      className="rounded-xl border border-warning-200 bg-warning-50 p-4"
    >
      <div className="flex items-center gap-2 text-warning-900">
        {latest.status === "refreshed" ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <AlertCircle className="size-4" />
        )}
        <h3 className="font-semibold">{t("courseAuthoring.sourceRefresh.title")}</h3>
        <Badge
          variant={latest.status === "refreshed" ? "success" : "inProgress"}
          className="ml-auto text-[10px]"
        >
          {t(`courseAuthoring.sourceRefresh.status.${latest.status}`)}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-warning-900">
        {latest.status === "refreshed"
          ? t("courseAuthoring.sourceRefresh.completed", {
              oldId: latest.oldSourceVersionId.slice(0, 8),
              replacementId: latest.replacementSourceVersionId.slice(0, 8),
            })
          : t("courseAuthoring.sourceRefresh.mappingNeeded")}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-700">
        <div>
          <dt className="text-neutral-500">{t("courseAuthoring.sourceRefresh.affectedTasks")}</dt>
          <dd className="font-medium">
            {latest.affectedTaskIds.length
              ? latest.affectedTaskIds.map((id) => id.slice(0, 8)).join(", ")
              : t("courseAuthoring.sourceRefresh.none")}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">
            {t("courseAuthoring.sourceRefresh.affectedProposals")}
          </dt>
          <dd className="font-medium">
            {latest.affectedProposalIds.length
              ? latest.affectedProposalIds.map((id) => id.slice(0, 8)).join(", ")
              : t("courseAuthoring.sourceRefresh.none")}
          </dd>
        </div>
      </dl>
      {latest.status === "needs_mapping" && (
        <div className="mt-3 space-y-3 rounded-lg border border-warning-200 bg-white p-3">
          <p className="text-xs leading-5 text-neutral-700">
            {t("courseAuthoring.sourceRefresh.mappingInstruction")}
          </p>
          {mappingBlockedMessage ? (
            <p className="text-xs text-destructive">{mappingBlockedMessage}</p>
          ) : (
            <>
              {coverageImpacts.length > 0 && (
                <div className="space-y-2 border-b border-neutral-100 pb-3">
                  <div>
                    <p className="text-xs font-medium text-neutral-900">
                      {t("courseAuthoring.sourceRefresh.lessonTasks")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600">
                      {t("courseAuthoring.sourceRefresh.lessonTasksHint")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {coverageImpacts.map((impact) => {
                      const lesson = course?.chapters
                        .flatMap((chapter) => chapter.lessons)
                        .find((candidate) => candidate.id === impact.lessonId);
                      const label =
                        lesson?.title ??
                        impact.lessonTitle ??
                        t("courseAuthoring.sourceRefresh.lessonFallback", {
                          taskId: impact.taskId.slice(0, 8),
                        });
                      const canUpdate = taskCanBeUpdated(impact);
                      const checked = currentSelectedTaskIds.includes(impact.taskId);
                      return (
                        <label
                          key={impact.taskId}
                          className="flex items-start gap-2 rounded-md px-1 py-1 text-xs text-neutral-700"
                        >
                          <Checkbox
                            aria-label={label}
                            checked={checked}
                            disabled={disabled || !canUpdate}
                            onCheckedChange={(value) =>
                              setSelectedTaskIds((current) => {
                                const selected =
                                  current ?? selectableImpacts.map((item) => item.taskId);
                                return value === true
                                  ? [...new Set([...selected, impact.taskId])]
                                  : selected.filter((taskId) => taskId !== impact.taskId);
                              })
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{label}</span>
                            {!canUpdate && (
                              <span className="block text-[11px] text-neutral-500">
                                {t("courseAuthoring.sourceRefresh.lessonNotEligible")}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {unmappedSections.map(({ sectionId, kind }) => {
                const key = `${latest.refreshId ?? latest.sequence}:${sectionId}`;
                return (
                  <div key={sectionId} className="space-y-1">
                    <p className="text-xs font-medium">
                      {t("courseAuthoring.sourceRefresh.mappingFor", {
                        sectionId: sectionId.slice(0, 8),
                      })}
                      <span className="ml-1 text-neutral-500">
                        ({t(`courseAuthoring.sourceRefresh.sectionKind.${kind}`)})
                      </span>
                    </p>
                    <Select
                      open={openMappingKey === key}
                      onOpenChange={(open) => setOpenMappingKey(open ? key : null)}
                      value={mappingSelections[key] ?? ""}
                      onValueChange={(value) =>
                        setMappingSelections((current) => ({ ...current, [key]: value }))
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger
                        aria-label={t("courseAuthoring.sourceRefresh.mappingFor", {
                          sectionId: sectionId.slice(0, 8),
                        })}
                        className="pointer-events-auto bg-white"
                        style={{ pointerEvents: "auto" }}
                        onPointerDown={(event) => {
                          if (openMappingKey !== key) return;
                          event.preventDefault();
                          event.stopPropagation();
                          setOpenMappingKey(null);
                        }}
                      >
                        <SelectValue
                          placeholder={t("courseAuthoring.sourceRefresh.chooseMapping")}
                        />
                      </SelectTrigger>
                      <SelectContent
                        className="z-[80] pointer-events-auto"
                        style={{ zIndex: 80, pointerEvents: "auto" }}
                        onEscapeKeyDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setOpenMappingKey(null);
                        }}
                        onPointerDownOutside={() => setOpenMappingKey(null)}
                      >
                        <SelectItem value={CLEAR_MAPPING}>
                          {t("courseAuthoring.sourceRefresh.clearMapping")}
                        </SelectItem>
                        {replacement?.sections
                          .filter((section) => section.status === "ready")
                          .map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {t("courseAuthoring.sourceRefresh.mapTo", {
                                label: sourceSectionLabel(section),
                              })}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              <Button
                type="button"
                size="sm"
                data-testid={COURSE_AUTHORING_HANDLES.SOURCE_REFRESH_RESOLVE_BUTTON}
                disabled={disabled || !mappingComplete}
                onClick={resolveMapping}
              >
                {t("courseAuthoring.sourceRefresh.resolveMapping")}
              </Button>
              {!mappingComplete && (
                <p className="text-xs text-warning-800">
                  {mappingConflict
                    ? t("courseAuthoring.sourceRefresh.mappingConflict")
                    : t("courseAuthoring.sourceRefresh.mappingRequired")}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
