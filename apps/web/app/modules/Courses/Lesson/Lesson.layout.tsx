import { Outlet, redirect } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { Navigation } from "~/components/Navigation";
import { getNavigationConfig, mapNavigationItems } from "~/config/navigationConfig";
import { RouteGuard } from "~/Guards/RouteGuard";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";

export const clientLoader = async ({ request }: { request: Request }) => {
  try {
    const user = await queryClient.ensureQueryData(currentUserQueryOptions);

    if (!user) {
      saveEntryToNavigationHistory(request);

      throw redirect("/auth/login");
    }
  } catch (error) {
    throw redirect("/auth/login");
  }

  return null;
};

export default function LessonLayout() {
  const { t } = useTranslation();
  const { currentUser } = useCurrentUserStore();

  return (
    <div className="flex max-h-dvh flex-col">
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        <Navigation
          menuItems={mapNavigationItems(getNavigationConfig(currentUser?.role === "user", t))}
        />
        <main className="relative flex-1 overflow-y-auto bg-primary-50">
          <RouteGuard>
            <Outlet />
          </RouteGuard>
        </main>
      </div>
    </div>
  );
}
