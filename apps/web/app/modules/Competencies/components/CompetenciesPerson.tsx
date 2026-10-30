import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetencyProfiles } from "~/api/queries/useCompetencyProfiles";
import { useCompetencySubject } from "~/api/queries/useCompetencySubject";
import { Button } from "~/components/ui/button";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { PICKER_PAGE } from "../utils/competenciesPicker.utils";

import { CompetenciesDocuments } from "./CompetenciesDocuments";
import { CompetenciesProfilePicker } from "./CompetenciesProfilePicker";
import { CompetencySubject } from "./CompetencySubject";

export function CompetenciesPerson({
  subjectId,
  userId,
  canManage,
  canCompare,
  backLabel,
  onBack,
}: {
  subjectId: string;
  userId: string;
  canManage: boolean;
  canCompare: boolean;
  backLabel?: string;
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const [compareProfileId, setCompareProfileId] = useState("");
  const hasProfiles = Boolean(
    useCompetencyProfiles(PICKER_PAGE, canCompare).data?.pagination.totalItems,
  );
  const { data, isPending, isError, refetch } = useCompetencySubject(
    subjectId,
    compareProfileId || undefined,
  );
  useEffect(() => {
    if (compareProfileId && isError) setCompareProfileId("");
  }, [compareProfileId, isError]);

  return (
    <div
      className="flex flex-col gap-5"
      data-testid={onBack ? COMPETENCIES_HANDLES.PERSON : undefined}
    >
      {onBack && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="-ml-3 gap-2" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Button>
        </div>
      )}
      {isPending && <CompetenciesLoading label={t("competencies.loading")} />}
      {isError && !isPending && (
        <CompetenciesError
          title={t("competencies.serviceError")}
          actionLabel={t("competencies.retry")}
          onRetry={() => void refetch()}
        />
      )}
      {data && (
        <>
          <CompetencySubject
            workspace={data}
            subjectId={subjectId}
            userId={userId}
            canManage={canManage}
            headerAction={
              canCompare &&
              hasProfiles && (
                <CompetenciesProfilePicker
                  label={t("competencies.compareProfile")}
                  hideLabel
                  value={compareProfileId}
                  emptyLabel={t("competencies.compareWithAssigned")}
                  onChange={setCompareProfileId}
                />
              )
            }
          />
          {data.profile && (
            <CompetenciesDocuments
              key={subjectId}
              workspace={data}
              subjectId={subjectId}
              userId={userId}
            />
          )}
        </>
      )}
    </div>
  );
}
