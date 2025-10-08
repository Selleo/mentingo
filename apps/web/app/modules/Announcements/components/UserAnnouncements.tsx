import { useAnnouncementsForUser } from "~/api/queries/useAnnouncementsForUser";
import { useScrollToElementWithId } from "~/hooks/useScrollToElementWithId";
import Loader from "~/modules/common/Loader/Loader";

import AnnouncementsList from "./AnnouncementsList";

export default function UserAnnouncements() {
  const { data: announcements, isLoading } = useAnnouncementsForUser();

  useScrollToElementWithId(!isLoading && !!announcements);

  if (isLoading) {
    return (
      <div className="flex h-full w-full">
        <Loader />
      </div>
    );
  }

  return <AnnouncementsList announcements={announcements || []} isAdminView={false} />;
}
