import { useTranslation } from "react-i18next";

import AnnouncementCard from "./AnnouncementCard";

import type { GetAnnouncementsForUserResponse } from "~/api/generated-api";

interface AnnouncementsListProps {
  announcements: GetAnnouncementsForUserResponse["data"];
  isAdminView: boolean;
}

export default function AnnouncementsList({ announcements, isAdminView }: AnnouncementsListProps) {
  const { t } = useTranslation();

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
        <div className="flex justify-center mt-8 body-base-md">
          {t("announcements.other.noNewAnnouncements")}
        </div>
      )}
    </div>
  );
}
