import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useCreateAchievement } from "~/api/mutations/admin/useAchievementMutations";
import { PageWrapper } from "~/components/PageWrapper";
import { setPageTitle } from "~/utils/setPageTitle";

import { AchievementForm } from "./AchievementForm";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createAchievement");

export default function CreateAchievementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: createAchievement, isPending } = useCreateAchievement();

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("adminAchievementsView.breadcrumbs.achievements"), href: "/admin/achievements" },
        { title: t("adminAchievementsView.breadcrumbs.create"), href: "/admin/achievements/new" },
      ]}
    >
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-neutral-950">
          {t("adminAchievementsView.createTitle")}
        </h1>
        <AchievementForm
          submitLabel={t("common.button.create")}
          isSubmitting={isPending}
          onSubmit={(payload) =>
            createAchievement(payload, {
              onSuccess: (achievement) => navigate(`/admin/achievements/${achievement.id}`),
            })
          }
        />
      </div>
    </PageWrapper>
  );
}
