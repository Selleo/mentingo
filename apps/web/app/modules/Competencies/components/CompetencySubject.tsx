import { CompetenciesEmpty } from "../CompetenciesStates";
import { useCompetencySubject } from "../hooks/useCompetencySubject";

import { CompetenciesSelect } from "./CompetenciesSelect";
import { CompetencyEvidenceForm } from "./CompetencyEvidenceForm";
import { CompetencyRequirementTable } from "./CompetencyRequirementTable";
import { CompetencyRevocationForm } from "./CompetencyRevocationForm";
import { CompetencySubjectDetails } from "./CompetencySubjectDetails";
import { CompetencySubjectHeader } from "./CompetencySubjectHeader";

import type { CompetencySubjectOptions } from "../hooks/competencies-hooks.types";

export type CompetencySubjectProps = CompetencySubjectOptions;

export function CompetencySubject({
  workspace,
  subjectId,
  userId,
  canManage = false,
  headerAction,
}: CompetencySubjectProps) {
  const {
    t,
    download,
    isPending,
    form,
    setForm,
    selectedId,
    setSelectedId,
    requirementFilter,
    setRequirementFilter,
    revocation,
    setRevocation,
    assessment,
    personName,
    profilePictureUrl,
    profileName,
    summaryMessage,
    activeDefinitions,
    canInspectCompetencies,
    hasNoProfile,
    requirementRows,
    visibleRequirementRows,
    statusMessage,
  } = useCompetencySubject({ workspace, subjectId, userId, canManage, headerAction });
  return (
    <div className="flex flex-col gap-5">
      <CompetencySubjectHeader
        assessment={assessment}
        personName={personName}
        profilePictureUrl={profilePictureUrl}
        profileName={profileName}
        summaryMessage={summaryMessage}
        headerAction={headerAction}
      />
      {hasNoProfile && canInspectCompetencies && activeDefinitions.length > 0 && (
        <div className="max-w-sm">
          <CompetenciesSelect
            label={t("competencies.inspectCompetency")}
            hideLabel
            value=""
            emptyLabel={t("competencies.inspectCompetency")}
            options={activeDefinitions.map((definition) => ({
              value: definition.id,
              label: definition.name,
            }))}
            onChange={setSelectedId}
          />
        </div>
      )}
      {hasNoProfile && (
        <CompetenciesEmpty
          title={t("competencies.employee.noProfileTitle")}
          message={t(
            subjectId === userId
              ? "competencies.employee.noProfileSelf"
              : "competencies.employee.noProfileOther",
          )}
        />
      )}
      {!hasNoProfile && (
        <>
          <CompetencyRequirementTable
            setSelectedId={setSelectedId}
            requirementFilter={requirementFilter}
            setRequirementFilter={setRequirementFilter}
            requirementRows={requirementRows}
            visibleRequirementRows={visibleRequirementRows}
            statusMessage={statusMessage}
            workspace={workspace}
          />
        </>
      )}
      <CompetencySubjectDetails
        download={download}
        isPending={isPending}
        setForm={setForm}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        setRevocation={setRevocation}
        activeDefinitions={activeDefinitions}
        workspace={workspace}
        subjectId={subjectId}
        userId={userId}
        canManage={canManage}
      />
      {form && (
        <CompetencyEvidenceForm
          competency={form.competency}
          subjectId={subjectId}
          recognition={form.recognition}
          condition={form.condition}
          onClose={() => setForm(null)}
        />
      )}
      {revocation && (
        <CompetencyRevocationForm
          competency={revocation.competency}
          conditions={revocation.conditions}
          subjectId={subjectId}
          onClose={() => setRevocation(null)}
        />
      )}
    </div>
  );
}

export { CompetencyConditionOverride } from "./CompetencyConditionOverride";
