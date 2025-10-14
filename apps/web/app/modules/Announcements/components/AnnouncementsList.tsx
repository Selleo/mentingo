import AnnouncementCard from "./AnnouncementCard";

import type { GetAnnouncementsForUserResponse } from "~/api/generated-api";

interface AnnouncementsListProps {
  announcements: GetAnnouncementsForUserResponse["data"];
  isAdminView: boolean;
}

export default function AnnouncementsList({ announcements, isAdminView }: AnnouncementsListProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      {announcements.length ? (
        announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            isAdminView={isAdminView}
          />
        ))
      ) : (
        <div className="flex justify-center mt-8">You&apos;re up to date</div>
      )}
    </div>
  );
}
