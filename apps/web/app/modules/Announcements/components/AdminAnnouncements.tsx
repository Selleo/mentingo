import { useMemo } from "react";

import { useAllAnnouncementsSuspense } from "~/api/queries/admin/useAllAnnouncements";
import Loader from "~/modules/common/Loader/Loader";

import AnnouncementsList from "./AnnouncementsList";

export default function AdminAnnouncements() {
  const { data: announcements, isLoading } = useAllAnnouncementsSuspense();

  const standardizedAnnouncements = useMemo(
    () =>
      announcements.map((announcement) => ({
        ...announcement,
        isRead: true,
      })),
    [announcements],
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full">
        <Loader />
      </div>
    );
  }

  return <AnnouncementsList announcements={standardizedAnnouncements || []} isAdminView />;
}
