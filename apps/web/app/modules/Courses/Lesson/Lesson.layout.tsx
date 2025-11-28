import { Outlet, redirect } from "@remix-run/react";

import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { RouteGuard } from "~/Guards/RouteGuard";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";

import type { MetaFunction } from "@remix-run/react";
import type { ParentRouteData } from "~/modules/layout";
import { VideoPlayerSingleton } from "~/components/VideoPlayer/VideoPlayerSingleton";
import { VideoProvider } from "~/components/VideoPlayer/VideoPlayerContext";

export const meta: MetaFunction = ({ matches }) => {
  const parentMatch = matches.find((match) => match.id.includes("layout"));
  const companyShortName = (parentMatch?.data as ParentRouteData)?.companyInfo?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - Lesson` : "Lesson";

  return [{ title }];
};

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
  return (
    <VideoProvider>
      <main className="relative flex-1 overflow-y-auto bg-primary-50">
        <VideoPlayerSingleton />
        <RouteGuard>
          <Outlet />
        </RouteGuard>
      </main>
    </VideoProvider>
  );
}
