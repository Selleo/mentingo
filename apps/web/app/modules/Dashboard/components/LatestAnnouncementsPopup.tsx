import { useState } from "react";

import { useUserRole } from "~/hooks/useUserRole";
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

  const { isAdmin } = useUserRole();

  const isVisible = useAnnouncementsPopupStore((state) => state.isVisible);
  const setIsVisible = useAnnouncementsPopupStore((state) => state.setIsVisible);

  if (!isVisible || isAdmin || !latestUnreadAnnouncements.length) return null;

  return (
    <div className="absolute z-30 mt-2 w-full space-y-4 md:mt-8">
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
