import { useTranslation } from "react-i18next";

import { Accordion } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { getCompetencySubjectDetails } from "../utils/competencySubject.utils";

import { CompetencyConfirmationHistory } from "./CompetencyConfirmationHistory";
import { CompetencyDetailSummary } from "./CompetencyDetailSummary";
import { CompetencyLevelConditions } from "./CompetencyLevelConditions";

import type { CompetencySubjectModel } from "../hooks/competencies-hook-models.types";

type CompetencySubjectDetailsProps = Pick<
  CompetencySubjectModel,
  | "download"
  | "isPending"
  | "setForm"
  | "selectedId"
  | "setSelectedId"
  | "setRevocation"
  | "activeDefinitions"
  | "workspace"
  | "subjectId"
  | "userId"
  | "canManage"
>;

export function CompetencySubjectDetails({
  download,
  isPending,
  setForm,
  selectedId,
  setSelectedId,
  setRevocation,
  activeDefinitions,
  workspace,
  subjectId,
  userId,
  canManage,
}: CompetencySubjectDetailsProps) {
  const { t, i18n } = useTranslation();
  const definition = activeDefinitions.find((item) => item.id === selectedId);
  const details =
    definition && getCompetencySubjectDetails(workspace, definition, userId, subjectId);

  return (
    <Dialog
      open={Boolean(selectedId)}
      onOpenChange={(open) => {
        if (!open) setSelectedId(null);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-2 border-b border-neutral-200 px-6 py-5 text-left">
          <DialogTitle className="pr-6">{definition?.name}</DialogTitle>
          <DialogDescription>{definition?.description}</DialogDescription>
        </DialogHeader>
        {definition && details && (
          <section className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto px-6 py-5">
            <CompetencyDetailSummary
              current={details.current}
              nextLevel={details.nextLevel}
              requiredLevel={details.requiredLevel}
            />
            {(details.standing.effectiveFrom || details.standing.effectiveUntil) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700">
                {details.standing.effectiveFrom && (
                  <span>
                    {t("competencies.confirmedFrom", {
                      date: formatLocalizedDate(i18n.language, details.standing.effectiveFrom),
                    })}
                  </span>
                )}
                {details.standing.effectiveUntil && (
                  <span>
                    {t("competencies.expiresOn", {
                      date: formatLocalizedDate(i18n.language, details.standing.effectiveUntil),
                    })}
                    {details.standing.expiring && (
                      <span className="ml-2 font-medium text-warning-800">
                        {t("competencies.expiring")}
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
            {details.attainedLevelName && details.attainedLevelName !== details.current?.name && (
              <p className="text-sm text-neutral-700">
                {t("competencies.attainedLevel", { level: details.attainedLevelName })}
              </p>
            )}
            <div className="space-y-3">
              <h3 className="body-base-md text-neutral-950">
                {t("competencies.detailGuide.levels")}
              </h3>
              <Accordion
                key={definition.id}
                type="multiple"
                defaultValue={[
                  details.nextLevel?.id ?? details.current?.id ?? definition.levels[0]?.id ?? "",
                ]}
                className="flex flex-col gap-2"
              >
                {definition.levels.map((level, index) => (
                  <CompetencyLevelConditions
                    key={level.id}
                    setForm={setForm}
                    setSelectedId={setSelectedId}
                    workspace={workspace}
                    subjectId={subjectId}
                    userId={userId}
                    canManage={canManage}
                    level={level}
                    index={index}
                    current={details.current}
                    standing={details.standing}
                    definition={definition}
                    verifier={details.verifier}
                  />
                ))}
              </Accordion>
            </div>
            {((details.verifier && !definition.archived) ||
              (details.revocableConditions.length > 0 && details.current)) && (
              <div className="flex flex-wrap gap-2">
                {details.verifier && !definition.archived && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedId(null);
                      setForm({
                        competency: { ...definition, levels: details.verifiableLevels },
                        recognition: true,
                      });
                    }}
                  >
                    {t("competencies.recognize")}
                  </Button>
                )}
                {details.revocableConditions.length > 0 && details.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedId(null);
                      setRevocation({
                        competency: definition,
                        conditions: details.revocableConditions,
                      });
                    }}
                  >
                    {t("competencies.revokeConfirmation")}
                  </Button>
                )}
              </div>
            )}
            {(canManage || subjectId !== userId) && (
              <CompetencyConfirmationHistory
                evidence={details.evidence}
                download={download}
                isPending={isPending}
              />
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
