import { Link, useNavigate } from "@remix-run/react";
import { format } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteAchievement } from "~/api/mutations/admin/useAchievementMutations";
import { useAchievementsSuspense } from "~/api/queries/admin/useAchievements";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.achievements");

export default function AchievementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: achievements } = useAchievementsSuspense({ includeInactive });
  const { mutate: softDeleteAchievement, isPending: isDeleting } = useDeleteAchievement();

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("adminAchievementsView.breadcrumbs.achievements"), href: "/admin/achievements" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">
              {t("adminAchievementsView.title")}
            </h1>
            <p className="text-sm text-neutral-600">{t("adminAchievementsView.description")}</p>
          </div>
          <Link to="new">
            <Button>{t("adminAchievementsView.button.createNew")}</Button>
          </Link>
        </div>

        <label className="flex w-max items-center gap-2 text-sm text-neutral-700">
          <Checkbox
            checked={includeInactive}
            onCheckedChange={(checked) => setIncludeInactive(Boolean(checked))}
          />
          {t("adminAchievementsView.filters.includeInactive")}
        </label>

        <div className="overflow-hidden rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminAchievementsView.table.image")}</TableHead>
                <TableHead>{t("adminAchievementsView.table.name")}</TableHead>
                <TableHead>{t("adminAchievementsView.table.threshold")}</TableHead>
                <TableHead>{t("adminAchievementsView.table.status")}</TableHead>
                <TableHead>{t("adminAchievementsView.table.createdAt")}</TableHead>
                <TableHead className="text-right">{t("common.button.delete")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {achievements.map((achievement) => (
                <TableRow
                  key={achievement.id}
                  className="cursor-pointer"
                  onClick={() => navigate(achievement.id)}
                >
                  <TableCell>
                    <div className="h-12 w-12 overflow-hidden rounded-md bg-neutral-100">
                      {achievement.imageUrl && (
                        <img
                          src={achievement.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{achievement.localizedName}</TableCell>
                  <TableCell>{achievement.pointThreshold}</TableCell>
                  <TableCell>
                    <Badge variant={achievement.isActive ? "secondary" : "outline"}>
                      {achievement.isActive ? t("common.other.active") : t("common.other.archived")}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(achievement.createdAt), "PPpp")}</TableCell>
                  <TableCell className="text-right">
                    {achievement.isActive && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isDeleting}
                        onClick={(event) => {
                          event.stopPropagation();
                          softDeleteAchievement(achievement.id);
                        }}
                      >
                        {t("common.button.delete")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {achievements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-neutral-500">
                    {t("adminAchievementsView.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageWrapper>
  );
}
