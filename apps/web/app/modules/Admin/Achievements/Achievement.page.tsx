import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useUpdateAchievement } from "~/api/mutations/admin/useAchievementMutations";
import { useAchievement } from "~/api/queries/admin/useAchievements";
import { PageWrapper } from "~/components/PageWrapper";
import Loader from "~/modules/common/Loader/Loader";
import { setPageTitle } from "~/utils/setPageTitle";

import { AchievementForm } from "./AchievementForm";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.achievementDetails");

export default function AchievementPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { data: achievement, isLoading } = useAchievement(id);
  const { mutate: updateAchievement, isPending } = useUpdateAchievement();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!achievement) throw new Error(t("adminAchievementsView.error.notFound"));

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("adminAchievementsView.breadcrumbs.achievements"), href: "/admin/achievements" },
        {
          title: achievement.localizedName || t("adminAchievementsView.breadcrumbs.details"),
          href: `/admin/achievements/${id}`,
        },
      ]}
    >
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-neutral-950">
          {t("adminAchievementsView.editTitle")}
        </h1>
        <AchievementForm
          achievement={achievement}
          submitLabel={t("common.button.save")}
          isSubmitting={isPending}
          onSubmit={(payload) => updateAchievement({ id, payload })}
        />
      </div>
    </PageWrapper>
  );
}
