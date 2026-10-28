import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetencyProfiles } from "~/api/queries/useCompetencyProfiles";
import { useCompetencySubject } from "~/api/queries/useCompetencySubject";
import { Button } from "~/components/ui/button";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { COMPARE_PROFILE_OPTIONS_PAGE } from "../utils/competenciesWorkspace.utils";

import { CompetenciesDocuments } from "./CompetenciesDocuments";
import { CompetenciesSelect } from "./CompetenciesSelect";
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
  const profiles = useCompetencyProfiles(COMPARE_PROFILE_OPTIONS_PAGE, canCompare).data?.data ?? [];
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
              profiles.length > 0 && (
                <CompetenciesSelect
                  label={t("competencies.compareProfile")}
                  hideLabel
                  value={compareProfileId}
                  emptyLabel={t("competencies.compareWithAssigned")}
                  options={profiles.map((item) => ({ value: item.id, label: item.name }))}
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
