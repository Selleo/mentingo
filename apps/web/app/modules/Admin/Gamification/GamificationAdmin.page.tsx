import { Link, useNavigate } from "@remix-run/react";
import { ACHIEVEMENT_VISIBILITY } from "@repo/shared";
import { Eye, EyeOff, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useUpdateAchievementStatus } from "~/api/mutations/admin/useUpdateAchievementStatus";
import { useAdminAchievements } from "~/api/queries/admin/useAdminAchievements";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import Loader from "~/modules/common/Loader/Loader";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { AchievementBadge } from "~/modules/Gamification/AchievementBadge";
import { setPageTitle } from "~/utils/setPageTitle";

import { GAMIFICATION_ADMIN_HANDLES } from "../../../../e2e/data/gamification-admin/handles";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.gamification");

export default function GamificationAdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const {
    data: achievements = [],
    isPending: isLoadingAchievements,
    isError: hasAchievementsError,
  } = useAdminAchievements(language);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateAchievementStatus();

  return (
    <PageWrapper
      breadcrumbs={[{ title: t("gamification.admin.title"), href: "/admin/gamification" }]}
    >
      <div className="flex flex-col gap-6" data-testid={GAMIFICATION_ADMIN_HANDLES.PAGE}>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="h5">{t("gamification.admin.achievements.title")}</CardTitle>
              <CardDescription className="body-lg-md">
                {t("gamification.admin.achievements.description")}
              </CardDescription>
            </div>
            <Link to="/admin/gamification/achievements/new">
              <Button
                variant="primary"
                className="gap-2"
                data-testid={GAMIFICATION_ADMIN_HANDLES.CREATE_BUTTON}
              >
                <Plus className="size-4" />
                {t("gamification.admin.achievements.create")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {/* Without this, a failed request would look like a tenant with no achievements. */}
            {hasAchievementsError && (
              <ErrorPage
                title={t("gamification.admin.loadListFailed")}
                actionLabel={t("common.refreshPage")}
                onAction={() => window.location.reload()}
              />
            )}
            {isLoadingAchievements && (
              <div className="flex justify-center py-8">
                <Loader />
              </div>
            )}
            {!hasAchievementsError && !isLoadingAchievements && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("gamification.admin.columns.achievement")}</TableHead>
                    <TableHead>{t("gamification.admin.columns.event")}</TableHead>
                    <TableHead>{t("gamification.admin.columns.levels")}</TableHead>
                    <TableHead>{t("gamification.admin.columns.visibility")}</TableHead>
                    <TableHead>{t("gamification.admin.columns.enabled")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {achievements.map((achievement) => (
                    <TableRow
                      key={achievement.id}
                      data-testid={GAMIFICATION_ADMIN_HANDLES.row(achievement.id)}
                      onClick={() => navigate(`/admin/gamification/achievements/${achievement.id}`)}
                      className="cursor-pointer hover:bg-neutral-100"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <AchievementBadge
                            level={1}
                            icon={achievement.icon}
                            badgeImageUrl={achievement.levels[0]?.badgeImageUrl}
                            className="h-8"
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="body-sm-md text-neutral-950">
                                {achievement.title}
                              </span>
                              {achievement.isPredefined && (
                                <Badge variant="notStarted" className="px-1.5 py-0.5 text-[11px]">
                                  {t("gamification.admin.predefined")}
                                </Badge>
                              )}
                            </div>
                            {achievement.description && (
                              <span
                                title={achievement.description}
                                className="details line-clamp-1 max-w-md text-neutral-600"
                              >
                                {achievement.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{t(`gamification.admin.events.${achievement.eventType}`)}</span>
                          <span className="details text-neutral-500">
                            {t(`gamification.admin.requirements.${achievement.requirementType}`)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {t("gamification.admin.levelsSummary", {
                          levels: achievement.levels.length,
                          xp: achievement.levels.reduce((sum, level) => sum + level.xpReward, 0),
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 body-sm text-neutral-700">
                          {achievement.visibility === ACHIEVEMENT_VISIBILITY.HIDDEN ? (
                            <EyeOff aria-hidden className="size-4 shrink-0" />
                          ) : (
                            <Eye aria-hidden className="size-4 shrink-0" />
                          )}
                          {t(`gamification.admin.visibility.${achievement.visibility}`)}
                        </span>
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Switch
                          checked={achievement.isEnabled}
                          disabled={isUpdatingStatus}
                          aria-label={t("gamification.admin.columns.enabled")}
                          onCheckedChange={(isEnabled) =>
                            updateStatus({ id: achievement.id, isEnabled })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
