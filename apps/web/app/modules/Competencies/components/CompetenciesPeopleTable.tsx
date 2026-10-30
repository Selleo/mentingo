import { useTranslation } from "react-i18next";

import { Progress } from "~/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { tableHeadClassName } from "../utils/competenciesOverview.utils";

import { CompetenciesPersonAvatar } from "./CompetenciesPersonAvatar";
import { CompetenciesProfilePicker } from "./CompetenciesProfilePicker";
import { CompetencyReadinessBadge } from "./CompetencyReadinessBadge";

import type { CompetenciesOverviewModel } from "../hooks/competencies-hook-models.types";

type CompetenciesPeopleTableProps = Pick<
  CompetenciesOverviewModel,
  "execute" | "isPending" | "profiles" | "people" | "canManage" | "onPersonOpen"
>;

export function CompetenciesPeopleTable({
  execute,
  isPending,
  profiles,
  people,
  canManage,
  onPersonOpen,
}: CompetenciesPeopleTableProps) {
  const { t } = useTranslation();
  return (
    <Table aria-label={t("competencies.overview.peopleTitle")}>
      <TableHeader className="bg-neutral-50">
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(tableHeadClassName, "pl-6")}>
            {t("competencies.person")}
          </TableHead>
          <TableHead className={cn(tableHeadClassName, "w-72 min-w-56")}>
            {t("competencies.profile")}
          </TableHead>
          <TableHead className={cn(tableHeadClassName, "min-w-44")}>
            {t("competencies.overview.readiness")}
          </TableHead>
          <TableHead className={cn(tableHeadClassName, "pr-6")}>
            {t("competencies.tableStatus")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((item) => (
          <TableRow
            key={item.id}
            data-testid={COMPETENCIES_HANDLES.PERSON_ROW(item.id)}
            className="cursor-pointer"
            onClick={() => onPersonOpen(item.id)}
          >
            <TableCell className="pl-6">
              <button
                type="button"
                className="flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                onClick={(event) => {
                  event.stopPropagation();
                  onPersonOpen(item.id);
                }}
              >
                <CompetenciesPersonAvatar
                  name={item.name}
                  profilePictureUrl={item.profilePictureUrl}
                />
                <span className="body-sm-md text-neutral-950 hover:text-primary-700">
                  {item.name}
                </span>
              </button>
            </TableCell>
            <TableCell className="w-72 min-w-56">
              {canManage && profiles.length > 0 ? (
                <CompetenciesProfilePicker
                  label={`${t("competencies.profile")}: ${item.name}`}
                  hideLabel
                  value={item.profileId ?? ""}
                  selectedLabel={item.profileName ?? undefined}
                  emptyLabel={t("competencies.noProfile")}
                  disabled={isPending}
                  onChange={(profileId) =>
                    void execute({
                      operation: "assign_profile",
                      subjectId: item.id,
                      profileId: profileId || null,
                    }).catch(() => undefined)
                  }
                />
              ) : (
                <span className="body-sm text-neutral-900">
                  {item.profileName ?? t("competencies.noProfile")}
                </span>
              )}
            </TableCell>
            <TableCell className="min-w-44">
              {item.requirementCount > 0 ? (
                <div className="flex items-center gap-3">
                  <Progress
                    value={(item.metCount / item.requirementCount) * 100}
                    aria-label={t("competencies.requirementsMet", {
                      met: item.metCount,
                      total: item.requirementCount,
                    })}
                    className="h-1.5 w-24 bg-neutral-100"
                    indicatorClassName={cn({
                      "bg-success-500": item.metCount === item.requirementCount,
                      "bg-primary-700": item.metCount < item.requirementCount,
                    })}
                  />
                  <span className="details-md whitespace-nowrap text-neutral-900">
                    {item.metCount}/{item.requirementCount}
                  </span>
                </div>
              ) : (
                <span className="details text-neutral-700">-</span>
              )}
            </TableCell>
            <TableCell className="pr-6">
              <CompetencyReadinessBadge readiness={item} />
            </TableCell>
          </TableRow>
        ))}
        {!people.length && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={4} className="py-10 text-center text-sm text-neutral-800">
              {t("competencies.overview.noMatches")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
