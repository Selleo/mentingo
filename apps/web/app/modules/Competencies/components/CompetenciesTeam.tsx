import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "~/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { CompetenciesSelect } from "./CompetenciesSelect";
import { CompetencyExpiryDetails } from "./CompetencyExpiryDetails";
import { CompetencyStatus } from "./CompetencyStatus";

import type { CompetenciesWorkspace, CompetencyProfile } from "../competencies.types";

export function CompetenciesTeam({
  workspace,
  profiles,
  profileId,
  onProfileChange,
  onSubject,
}: {
  workspace: CompetenciesWorkspace;
  profiles: CompetencyProfile[];
  profileId: string;
  onProfileChange: (id: string) => void;
  onSubject: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const profile = profiles.find((item) => item.id === profileId);
  const definitions = workspace.catalog.filter(
    (item) =>
      !item.archived &&
      profile?.requirements.some((requirement) => requirement.competencyId === item.id),
  );
  const subjects = workspace.assessments.filter(
    (item) =>
      workspace.subjects.some(
        (subject) => subject.id === item.subjectId && subject.profileId === profileId,
      ) &&
      workspace.people.some(
        (person) =>
          person.id === item.subjectId &&
          person.canPlan &&
          person.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      ),
  );
  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Label htmlFor="competency-person-search" className="sr-only">
                {t("competencies.searchPeople")}
              </Label>
              <Search
                className="absolute left-3 top-3 size-4 text-neutral-700"
                aria-hidden="true"
              />
              <Input
                id="competency-person-search"
                className="pl-9"
                placeholder={t("competencies.searchPeople")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div
            className="flex flex-wrap gap-4 text-xs text-neutral-800"
            aria-label={t("competencies.statusLegend")}
          >
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-success-600" aria-hidden="true" />
              {t("competencies.met")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-error-600" aria-hidden="true" />
              {t("competencies.missing")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-warning-600" aria-hidden="true" />
              {t("competencies.expiring")}
            </span>
          </div>
        </div>
        <section className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 p-5">
            {profiles.length > 1 ? (
              <div className="w-full sm:w-72">
                <CompetenciesSelect
                  label={t("competencies.profile")}
                  hideLabel
                  value={profileId}
                  options={profiles.map((item) => ({ value: item.id, label: item.name }))}
                  onChange={onProfileChange}
                />
              </div>
            ) : (
              <h2 className="text-xl font-semibold leading-7 text-neutral-950">
                {profile?.name ?? t("competencies.noProfile")}
              </h2>
            )}
          </div>
          <Table
            className="[&_td]:border-r [&_td:last-child]:border-r-0 [&_th]:border-r [&_th:last-child]:border-r-0"
            aria-label={t("competencies.matrix")}
          >
            <TableHeader className="bg-primary-50">
              <TableRow>
                <TableHead scope="col" className="w-40 min-w-40 sm:w-56 sm:min-w-56">
                  {t("competencies.person")}
                </TableHead>
                {definitions.map((item) => (
                  <TableHead
                    scope="col"
                    key={item.id}
                    className="min-w-40 py-3 text-center sm:whitespace-nowrap"
                  >
                    {item.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((assessment) => (
                <TableRow key={assessment.subjectId}>
                  <TableCell>
                    <Button
                      variant="link"
                      className="h-auto whitespace-normal p-0 text-left font-semibold text-primary-800"
                      onClick={() => onSubject(assessment.subjectId)}
                    >
                      {workspace.people.find((person) => person.id === assessment.subjectId)
                        ?.name ?? t("competencies.archivedAccount")}
                    </Button>
                  </TableCell>
                  {definitions.map((definition) => {
                    const requirement = assessment.requirements.find(
                      (item) => item.requirement.competencyId === definition.id,
                    );
                    const standing = requirement?.standing;
                    const currentLevel = definition.levels.findIndex(
                      (level) => level.id === standing?.currentLevelId,
                    );
                    const requiredIndex = definition.levels.findIndex(
                      (level) => level.id === requirement?.requirement.levelId,
                    );
                    const currentName =
                      currentLevel >= 0
                        ? `L${currentLevel + 1} - ${definition.levels[currentLevel].name}`
                        : t("competencies.noLevel");
                    const requiredName =
                      requiredIndex >= 0
                        ? `L${requiredIndex + 1} - ${definition.levels[requiredIndex].name}`
                        : t("competencies.noLevel");
                    let statusKey = requirement?.met ? "met" : "missing";
                    const value =
                      requiredIndex >= 0 ? `L${requiredIndex + 1}` : t("competencies.noLevel");
                    if (standing?.expiring) statusKey = "expiring";
                    const status = t(`competencies.${statusKey}`);
                    const label = `${status}. ${t("competencies.currentLevel")}: ${currentName}. ${t("competencies.requiredLevel")}: ${requiredName}`;
                    return (
                      <TableCell key={definition.id} className="py-5 text-center">
                        <Tooltip>
                          <TooltipTrigger
                            type="button"
                            aria-label={label}
                            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-4"
                          >
                            <CompetencyStatus
                              confirmed={requirement?.met ?? false}
                              expiring={standing?.expiring}
                              compact
                              label={label}
                            >
                              {value}
                            </CompetencyStatus>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            {t(`competencies.matrixStatus.${statusKey}`)} · {value}
                            {standing?.expiring && (
                              <CompetencyExpiryDetails
                                definition={definition}
                                standing={standing}
                                workspace={workspace}
                              />
                            )}
                          </TooltipContent>
                        </Tooltip>
                        {standing?.expiring && standing.effectiveUntil && (
                          <p className="mt-2 text-xs text-warning-800">
                            {t("competencies.expiresOn", {
                              date: formatLocalizedDate(i18n.language, standing.effectiveUntil),
                            })}
                          </p>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {!subjects.length && (
                <TableRow>
                  <TableCell
                    className="py-12 text-center text-neutral-800"
                    colSpan={1 + definitions.length}
                  >
                    {t("competencies.noPeople")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </TooltipProvider>
  );
}
