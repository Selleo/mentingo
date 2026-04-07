import { Link } from "@remix-run/react";
import { OnboardingPages, PERMISSIONS } from "@repo/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { TooltipProvider } from "~/components/ui/tooltip";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { setPageTitle } from "~/utils/setPageTitle";

import { useTourSetup } from "../Onboarding/hooks/useTourSetup";
import { studentAnnouncementsSteps } from "../Onboarding/routes/student";

import { AdminAnnouncements, UserAnnouncements } from "./components";
import { getAnnouncementsPageBreadcrumbs } from "./components/getAnnouncementsBreadcrumbs";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.announcements");

export default function AnnouncementsPage() {
  const { t } = useTranslation();

  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });
  const { data: user, isLoading } = useCurrentUser();

  const steps = useMemo(
    () => (canUpdateLearningProgress ? studentAnnouncementsSteps(t) : []),
    [t, canUpdateLearningProgress],
  );

  useTourSetup({
    steps,
    hasCompletedTour: user?.onboardingStatus.announcements,
    isLoading,
    page: OnboardingPages.ANNOUNCEMENTS,
  });

  return (
    <PageWrapper breadcrumbs={getAnnouncementsPageBreadcrumbs(t)}>
      <TooltipProvider>
        <div className="mt-4 flex justify-center">
          <section className="flex w-full max-w-[720px] flex-col items-center gap-4">
            <div className="flex w-full flex-wrap items-center justify-between gap-x-4">
              <h1
                id="announcements"
                className={cn("h5 md:h3 text-center text-neutral-950", {
                  "w-full": !canManageUsers,
                })}
              >
                {t("announcements.page.header")}
              </h1>
              <div className="flex items-center gap-4">
                {canManageUsers && (
                  <Link to="/admin/announcements/new">
                    <Button variant="default">{t("announcements.page.buttons.new")}</Button>
                  </Link>
                )}
              </div>
            </div>
            {canManageUsers ? <AdminAnnouncements /> : <UserAnnouncements />}
          </section>
        </div>
      </TooltipProvider>
    </PageWrapper>
  );
}
