import { Outlet } from "@remix-run/react";
import { Suspense } from "react";

import { useCurrentUser } from "~/api/queries";
import { Navigation } from "~/components/Navigation/Navigation";
import { MFAGuard } from "~/Guards/MFAGuard";
import { RouteGuard } from "~/Guards/RouteGuard";
import { cn } from "~/lib/utils";
import { AssistantDock } from "~/modules/Assistant/AssistantDock";
import Loader from "~/modules/common/Loader/Loader";
import { GamificationRewardToasts } from "~/modules/Gamification/GamificationRewardToasts";
import { SupportModeBanner } from "~/modules/SupportMode/SupportModeBanner";

export default function NavigationWrapper() {
  const { data: currentUser } = useCurrentUser();

  return (
    <div
      className={cn("flex h-screen flex-col", {
        "min-h-screen border-2 border-warning-600": currentUser?.isSupportMode,
      })}
    >
      <SupportModeBanner />
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        {currentUser && <Navigation />}
        <MFAGuard mode="public">
          <RouteGuard>
            <>
              {/* Without this boundary a suspending page falls back to the root loader and unmounts the sidebar. */}
              <Suspense
                fallback={
                  <div
                    role="status"
                    aria-busy="true"
                    className="flex flex-1 items-center justify-center"
                  >
                    <Loader />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
              {currentUser && <AssistantDock actor={currentUser} />}
              {/* Mounted here, not per layout: rewards are mostly earned in lessons, and a remount marks pending rewards as already seen. */}
              {currentUser && <GamificationRewardToasts />}
            </>
          </RouteGuard>
        </MFAGuard>
      </div>
    </div>
  );
}
