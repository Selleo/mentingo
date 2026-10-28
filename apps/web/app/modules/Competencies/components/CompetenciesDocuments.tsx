import { Accordion } from "~/components/ui/accordion";

import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { useCompetenciesDocuments } from "../hooks/useCompetenciesDocuments";

import { CompetenciesDocumentGroup } from "./CompetenciesDocumentGroup";
import { CompetenciesSection } from "./CompetenciesSection";
import { CompetencyEvidenceForm } from "./CompetencyEvidenceForm";

import type { CompetenciesDocumentsOptions } from "../hooks/competencies-hooks.types";

export type CompetenciesDocumentsProps = CompetenciesDocumentsOptions;

export function CompetenciesDocuments({
  workspace,
  subjectId,
  userId,
}: CompetenciesDocumentsProps) {
  const {
    t,
    download,
    downloading,
    submission,
    setSubmission,
    canSubmit,
    showsSubmissions,
    recordsQuery,
    groups,
    levelIndexOf,
    description,
    isLoadingSubmissions,
  } = useCompetenciesDocuments({ workspace, subjectId, userId });
  return (
    <CompetenciesSection title={t("competencies.documents")} description={description || undefined}>
      {isLoadingSubmissions && <CompetenciesLoading label={t("competencies.loading")} />}
      {showsSubmissions && recordsQuery.isError && (
        <CompetenciesError
          title={t("competencies.serviceError")}
          actionLabel={t("competencies.retry")}
          onRetry={() => void recordsQuery.refetch()}
        />
      )}
      {!groups.length && !isLoadingSubmissions && (
        <CompetenciesEmpty message={t("competencies.noRequiredDocuments")} />
      )}
      {groups.length > 0 && (
        <Accordion
          type="multiple"
          className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200"
        >
          {groups.map((group) => {
            const { definition, steps } = group;
            const pendingCount = steps.filter((step) => step.pending).length;
            const missingCount = steps.length - pendingCount;
            return (
              <CompetenciesDocumentGroup
                key={definition.id}
                download={download}
                downloading={downloading}
                setSubmission={setSubmission}
                canSubmit={canSubmit}
                levelIndexOf={levelIndexOf}
                group={group}
                definition={definition}
                steps={steps}
                pendingCount={pendingCount}
                missingCount={missingCount}
              />
            );
          })}
        </Accordion>
      )}
      {submission && (
        <CompetencyEvidenceForm
          {...submission}
          subjectId={subjectId}
          onClose={() => setSubmission(null)}
        />
      )}
    </CompetenciesSection>
  );
}
