import { useTranslation } from "react-i18next";

import { ANNOUNCEMENTS_PAGE_HANDLES } from "../handles";

import AnnouncementCard from "./AnnouncementCard";

import type { GetAnnouncementsForUserResponse } from "~/api/generated-api";

interface AnnouncementsListProps {
  announcements: GetAnnouncementsForUserResponse["data"];
  isAdminView: boolean;
}

export default function AnnouncementsList({ announcements, isAdminView }: AnnouncementsListProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full flex-col gap-6" data-testid={ANNOUNCEMENTS_PAGE_HANDLES.LIST}>
      {announcements.length ? (
        announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            announcement={announcement}
            isAdminView={isAdminView}
          />
        ))
      ) : (
        <div
          className="mt-8 flex justify-center body-base-md"
          data-testid={ANNOUNCEMENTS_PAGE_HANDLES.EMPTY_STATE}
        >
          {t("announcements.other.noNewAnnouncements")}
        </div>
      )}
    </div>
  );
}
