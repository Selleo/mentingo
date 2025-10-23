import { Link } from "@remix-run/react";
import { OnboardingPages } from "@repo/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import { useTourSetup } from "../Onboarding/hooks/useTourSetup";
import { studentAnnouncementsSteps } from "../Onboarding/routes/student";

import { AdminAnnouncements, UserAnnouncements } from "./components";
import { getAnnouncementsPageBreadcrumbs } from "./components/getAnnouncementsBreadcrumbs";

export default function AnnouncementsPage() {
  const { t } = useTranslation();

  const { isAdmin, isStudent } = useUserRole();
  const { data: user, isLoading } = useCurrentUser();

  const steps = useMemo(() => (isStudent ? studentAnnouncementsSteps(t) : []), [t, isStudent]);

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
                className={cn("h5 md:h3 text-center text-neutral-950", { "w-full": !isAdmin })}
              >
                {t("announcements.page.header")}
              </h1>
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <Link to="/admin/announcements/new">
                    <Button variant="default">{t("announcements.page.buttons.new")}</Button>
                  </Link>
                )}
              </div>
            </div>
            {isAdmin ? <AdminAnnouncements /> : <UserAnnouncements />}
          </section>
        </div>
      </TooltipProvider>
    </PageWrapper>
  );
}
