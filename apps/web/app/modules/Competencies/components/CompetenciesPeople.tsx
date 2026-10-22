import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { CompetenciesSelect } from "./CompetenciesSelect";

import type { CompetenciesWorkspace } from "../competencies.types";

export function CompetenciesPeople({
  workspace,
  canManage,
  onSubject,
}: {
  workspace: CompetenciesWorkspace;
  canManage: boolean;
  onSubject: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [search, setSearch] = useState("");
  const people = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return workspace.people.filter(
      (person) =>
        !person.archived &&
        (canManage || person.canPlan) &&
        (!needle || person.name.toLocaleLowerCase().includes(needle)),
    );
  }, [canManage, search, workspace.people]);
  const profileName = (personId: string) => {
    const assignedProfile = workspace.subjects.find((item) => item.id === personId)?.profileId;
    return (
      workspace.publishedProfiles.find((item) => item.id === assignedProfile)?.name ??
      t("competencies.noProfile")
    );
  };
  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary-950">{t("competencies.people")}</h2>
          <p className="mt-1 text-sm text-neutral-800">{t("competencies.peopleDescription")}</p>
        </div>
        <Input
          aria-label={t("competencies.searchPeople")}
          className="w-full sm:w-64"
          placeholder={t("competencies.searchPeople")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <Table aria-label={t("competencies.people")}>
          <TableHeader className="bg-neutral-50">
            <TableRow>
              <TableHead>{t("competencies.person")}</TableHead>
              <TableHead className="w-80 min-w-64">{t("competencies.profile")}</TableHead>
              <TableHead>{t("competencies.title")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => {
              const standings = workspace.standings.filter(
                (item) => item.subjectId === person.id && item.standing.currentLevelId,
              );
              return (
                <TableRow key={person.id}>
                  <TableCell>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-left font-semibold"
                      onClick={() => onSubject(person.id)}
                    >
                      {person.name}
                    </Button>
                  </TableCell>
                  <TableCell className="w-80 min-w-64">
                    {(canManage || person.canPlan) && workspace.publishedProfiles.length ? (
                      <CompetenciesSelect
                        label={`${t("competencies.profile")}: ${person.name}`}
                        hideLabel
                        value={
                          workspace.subjects.find((item) => item.id === person.id)?.profileId ?? ""
                        }
                        emptyLabel={t("competencies.noProfile")}
                        options={workspace.publishedProfiles.map((profile) => ({
                          value: profile.id,
                          label: profile.name,
                        }))}
                        disabled={isPending}
                        onChange={(profileId) =>
                          void execute({
                            operation: "assign_profile",
                            subjectId: person.id,
                            profileId: profileId || null,
                          }).catch(() => undefined)
                        }
                      />
                    ) : (
                      profileName(person.id)
                    )}
                  </TableCell>
                  <TableCell>
                    {standings.length
                      ? standings
                          .map((item) => {
                            const definition = workspace.catalog.find(
                              (value) => value.id === item.standing.competencyId,
                            );
                            const level = definition?.levels.find(
                              (value) => value.id === item.standing.currentLevelId,
                            );
                            return `${definition?.name ?? t("competencies.unavailableLevel")}: ${level?.name ?? t("competencies.missing")}`;
                          })
                          .join(", ")
                      : t("competencies.noCompetencies")}
                  </TableCell>
                </TableRow>
              );
            })}
            {!people.length && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-sm text-neutral-800">
                  {t("competencies.noPeople")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
