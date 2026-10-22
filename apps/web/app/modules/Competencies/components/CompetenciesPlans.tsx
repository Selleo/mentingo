import { Link } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Pagination } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import {
  getSubjectDocumentSteps,
  getSubjectPlanActions,
  getSubjectRequiredSteps,
} from "../competenciesPlans.utils";

import { CompetenciesActionDetails } from "./CompetenciesActionDetails";
import { CompetenciesPlansTable } from "./CompetenciesPlansTable";
import { CompetenciesSelect } from "./CompetenciesSelect";

import type { CompetenciesWorkspace, CompetencyAction } from "../competencies.types";

export function CompetenciesActionEditor({
  workspace,
  subjectId,
  userId,
  action,
  close,
}: {
  workspace: CompetenciesWorkspace;
  subjectId: string;
  userId: string;
  action?: CompetencyAction;
  close: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [personId, setPersonId] = useState(action?.subjectId ?? subjectId);
  const gaps = workspace.standings
    .filter((item) => item.subjectId === personId)
    .flatMap((item) =>
      item.standing.levels
        .filter((level) => !level.met)
        .map((level) => ({
          value: `${item.standing.competencyId}:${level.levelId}`,
          label: `${workspace.catalog.find((value) => value.id === item.standing.competencyId)?.name} - ${workspace.catalog.find((value) => value.id === item.standing.competencyId)?.levels.find((value) => value.id === level.levelId)?.name}`,
        })),
    );
  const [gap, setGap] = useState(gaps[0]?.value ?? "");
  const [kind, setKind] = useState<CompetencyAction["kind"]>("practice");
  const [ownerId, setOwnerId] = useState(action?.ownerId ?? userId);
  const [objective, setObjective] = useState(action?.objective ?? "");
  const [dueDate, setDueDate] = useState(action?.dueDate?.slice(0, 10) ?? "");
  const [dialogContainer, setDialogContainer] = useState<HTMLDivElement | null>(null);
  const [courseId, setCourseId] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const canEditSubject = workspace.people.some(
    (person) => person.id === personId && !person.archived && person.canPlan,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) close();
      }}
    >
      <DialogContent
        ref={setDialogContainer}
        className="flex max-h-[90vh] flex-col"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{t(action ? "competencies.edit" : "competencies.createPlan")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-4 overflow-y-auto"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canEditSubject) return;
            const [competencyId, levelId] = gap.split(":");
            if (!action && (!competencyId || !levelId)) return;
            try {
              const fields = {
                ownerId,
                objective,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
              };
              await execute(
                action
                  ? {
                      operation: "update_action",
                      id: action.id,
                      subjectId: action.subjectId,
                      version: action.version,
                      status: action.status,
                      ...fields,
                    }
                  : {
                      operation: "create_action",
                      requestId,
                      value: {
                        subjectId: personId,
                        competencyId,
                        levelId,
                        kind,
                        ...fields,
                        ...(kind === "course" ? { courseId } : {}),
                      },
                    },
              );
              close();
            } catch {
              /* Preserve the action for retry. */
            }
          }}
        >
          <fieldset
            disabled={isPending || (!canEditSubject && Boolean(personId))}
            className="flex flex-col gap-4"
          >
            {!action && (
              <>
                {!subjectId && (
                  <CompetenciesSelect
                    label={t("competencies.person")}
                    value={personId}
                    emptyLabel={t("competencies.selectPerson")}
                    options={workspace.people
                      .filter((person) => person.canPlan)
                      .map((person) => ({ value: person.id, label: person.name }))}
                    onChange={(id) => {
                      setPersonId(id);
                      setGap("");
                    }}
                  />
                )}
                <CompetenciesSelect
                  label={t("competencies.targetGap")}
                  value={gap}
                  options={gaps}
                  onChange={setGap}
                />
                <CompetenciesSelect
                  label={t("competencies.actionKind")}
                  value={kind}
                  options={["course", "practice", "instruction", "mentoring", "renewal"].map(
                    (value) => ({ value, label: t(`competencies.kind.${value}`) }),
                  )}
                  onChange={(value) => setKind(value as typeof kind)}
                />
                {kind === "course" && (
                  <CompetenciesSelect
                    label={t("competencies.kind.course")}
                    value={courseId}
                    emptyLabel={t("competencies.selectCourse")}
                    options={workspace.courses.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                    onChange={setCourseId}
                  />
                )}
              </>
            )}
            <CompetenciesSelect
              label={t("competencies.owner")}
              value={ownerId}
              options={workspace.people
                .filter((person) => !person.archived)
                .map((person) => ({ value: person.id, label: person.name }))}
              onChange={setOwnerId}
            />
            <div className="space-y-2">
              <Label htmlFor="action-objective">{t("competencies.objective")}</Label>
              <Textarea
                id="action-objective"
                required
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <CalendarDateTimeField
                label={t("competencies.dueDate")}
                date={dueDate}
                time=""
                hideTime
                datePickerPortalContainer={dialogContainer}
                onDateChange={setDueDate}
                onTimeChange={() => undefined}
              />
              {dueDate && (
                <Button type="button" variant="link" size="sm" onClick={() => setDueDate("")}>
                  {t("competencies.clearDate")}
                </Button>
              )}
            </div>
          </fieldset>
          <DialogFooter className="gap-2 border-t border-neutral-200 pt-4 sm:gap-0">
            <Button type="button" variant="outline" disabled={isPending} onClick={close}>
              {t("competencies.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                !canEditSubject ||
                (!action && (!gap || (kind === "course" && !courseId)))
              }
            >
              {t("competencies.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function CompetenciesPlans({
  workspace,
  subjectId,
  userId,
  canPlan,
  canEnroll,
  onDocuments,
  pagination,
}: {
  workspace: CompetenciesWorkspace;
  subjectId: string;
  userId: string;
  canPlan: boolean;
  canEnroll: boolean;
  onDocuments?: (subjectId: string) => void;
  pagination?: {
    page: number;
    total: number;
    actions: CompetencyAction[];
    onPageChange: (page: number) => void;
    loading: boolean;
  };
}) {
  const { t, i18n } = useTranslation();

  const [editor, setEditor] = useState<CompetencyAction | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const actions = canPlan
    ? (pagination?.actions ?? workspace.actions).filter(
        (item) =>
          item.status !== "cancelled" &&
          (subjectId
            ? item.subjectId === subjectId
            : Boolean(pagination) ||
              workspace.people.some((person) => person.id === item.subjectId && person.canPlan)),
      )
    : getSubjectPlanActions(workspace, subjectId);
  const unmetSteps = canPlan ? [] : getSubjectRequiredSteps(workspace, subjectId);
  const documentSteps = canPlan ? [] : getSubjectDocumentSteps(workspace, subjectId);
  const requiredSteps = unmetSteps.filter(
    (step) =>
      !actions.some(
        (action) =>
          action.status !== "completed" &&
          action.competencyId === step.definition.id &&
          action.levelId === step.level.id &&
          (step.condition.kind !== "course" ||
            (action.kind === "course" && action.courseId === step.condition.resourceId)),
      ),
  );
  const actionDetails = actions
    .filter((action) => !canPlan || action.id === selectedId)
    .map((action) => {
      const subject = workspace.people.find((person) => person.id === action.subjectId);
      const target = workspace.catalog
        .find((item) => item.id === action.competencyId)
        ?.levels.find((level) => level.id === action.levelId);
      const description = canPlan
        ? t(`competencies.kind.${action.kind}`)
        : target?.conditions.map((condition) => condition.description).join("; ");
      if (!canPlan) {
        const needsDocument = documentSteps.some(
          (step) =>
            step.definition.id === action.competencyId &&
            step.level.id === action.levelId &&
            step.condition.kind === "document" &&
            !step.pending,
        );
        const canOpenDocuments =
          needsDocument &&
          subject &&
          !subject.archived &&
          onDocuments &&
          action.subjectId === userId;
        const canOpenCourse = action.kind === "course" && Boolean(action.courseId);
        return (
          <section
            key={action.id}
            data-testid={COMPETENCIES_HANDLES.ACTION(action.id)}
            className="flex items-start gap-3 py-3"
          >
            <span
              aria-hidden
              className="mt-1 size-3 shrink-0 rounded-full bg-primary-600 ring-4 ring-primary-50"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <h3 className="break-words font-semibold text-neutral-950">{action.objective}</h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-800">
                  {[
                    description,
                    action.dueDate &&
                      formatLocalizedDate(i18n.language, action.dueDate, "dd MMM yyyy"),
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>
              {action.status !== "completed" && (canOpenDocuments || canOpenCourse) && (
                <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
                  {canOpenDocuments && (
                    <Button variant="outline" onClick={() => onDocuments(action.subjectId)}>
                      {t("competencies.documents")}
                    </Button>
                  )}
                  {action.kind === "course" && action.courseId && (
                    <Button variant="outline" asChild>
                      <Link to={`/course/${action.courseId}`}>{t("competencies.openCourse")}</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      }
      return null;
    });
  const selectedAction = actions.find((item) => item.id === selectedId);
  return (
    <div className="flex flex-col gap-4" aria-busy={pagination?.loading}>
      {!actions.length && !requiredSteps.length && (
        <p className="rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-800">
          {t("competencies.noActions")}
        </p>
      )}
      {canPlan && actions.length > 0 && (
        <CompetenciesPlansTable
          actions={actions}
          people={workspace.people}
          onSelect={setSelectedId}
        />
      )}
      {canPlan && pagination && pagination.total > 0 && (
        <Pagination
          currentPage={pagination.page}
          totalItems={pagination.total}
          itemsPerPage={10}
          canChangeItemsPerPage={false}
          onPageChange={(page) => {
            setSelectedId(null);
            pagination.onPageChange(page);
          }}
        />
      )}
      {canPlan ? (
        <Dialog
          open={Boolean(selectedAction)}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
        >
          {selectedAction && (
            <CompetenciesActionDetails
              workspace={workspace}
              action={selectedAction}
              canEnroll={canEnroll}
              onDocuments={onDocuments}
              onEdit={() => setEditor(selectedAction)}
            />
          )}
        </Dialog>
      ) : (
        <div
          className={cn(
            (actions.length > 0 || requiredSteps.length > 0) &&
              "rounded-lg border border-neutral-200 bg-white p-5 sm:p-6",
          )}
        >
          {actionDetails}
          {requiredSteps.map(({ definition, level, condition, pending }) => {
            let caption = definition.name;
            if (condition.kind === "observation" || (condition.kind === "document" && pending)) {
              caption = t("competencies.employee.requiresConfirmation");
            }
            return (
              <section
                key={`${definition.id}:${level.id}:${condition.id}`}
                data-testid={COMPETENCIES_HANDLES.PLAN_STEP(definition.id, condition.id)}
                className="flex items-start gap-3 py-3"
              >
                <span
                  aria-hidden
                  className="mt-1 size-3 shrink-0 rounded-full bg-primary-600 ring-4 ring-primary-50"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <h3 className="break-words font-semibold text-neutral-950">
                      {condition.description}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-800">{caption}</p>
                  </div>
                  {condition.kind === "course" && condition.resourceId && (
                    <Button variant="outline" className="ml-auto shrink-0" asChild>
                      <Link to={`/course/${condition.resourceId}`}>
                        {t("competencies.openCourse")}
                      </Link>
                    </Button>
                  )}
                  {condition.kind === "document" &&
                    !pending &&
                    subjectId === userId &&
                    onDocuments &&
                    workspace.people.some(
                      (person) => person.id === subjectId && !person.archived,
                    ) && (
                      <Button
                        variant="outline"
                        className="ml-auto shrink-0"
                        onClick={() => onDocuments(subjectId)}
                      >
                        {t("competencies.documents")}
                      </Button>
                    )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {editor && (
        <CompetenciesActionEditor
          workspace={workspace}
          subjectId={subjectId}
          userId={userId}
          action={editor}
          close={() => setEditor(null)}
        />
      )}
    </div>
  );
}
