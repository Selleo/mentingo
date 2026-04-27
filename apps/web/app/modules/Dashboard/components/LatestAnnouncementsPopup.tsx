import { PERMISSIONS } from "@repo/shared";
import { useState } from "react";

import { usePermissions } from "~/hooks/usePermissions";
import { LATEST_ANNOUNCEMENTS_POPUP_HANDLES } from "~/modules/Announcements/handles";
import { useAnnouncementsPopupStore } from "~/modules/Dashboard/store/useAnnouncementsPopupStore";

import LatestAnnouncementCard from "./LatestAnnouncementCard";

import type { GetLatestUnreadAnnouncementsResponse } from "~/api/generated-api";

type LatestAnnouncementsPopupProps = {
  latestUnreadAnnouncements: GetLatestUnreadAnnouncementsResponse["data"];
};

export default function LatestAnnouncementsPopup({
  latestUnreadAnnouncements,
}: LatestAnnouncementsPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });

  const isVisible = useAnnouncementsPopupStore((state) => state.isVisible);
  const setIsVisible = useAnnouncementsPopupStore((state) => state.setIsVisible);

  if (!isVisible || canManageUsers || !latestUnreadAnnouncements.length) return null;

  return (
    <div
      className="absolute z-30 mt-2 w-full space-y-4 md:mt-8"
      data-testid={LATEST_ANNOUNCEMENTS_POPUP_HANDLES.ROOT}
    >
      <LatestAnnouncementCard
        announcement={latestUnreadAnnouncements[currentIndex]}
        setCurrentIndex={setCurrentIndex}
        setIsVisible={setIsVisible}
        currentIndex={currentIndex}
        announcementsCount={latestUnreadAnnouncements.length}
      />
    </div>
  );
}
