import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useMarkAnnouncementAsRead } from "~/api/mutations/useMarkAnnouncementAsRead";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";

import type { GetLatestUnreadAnnouncementsResponse } from "~/api/generated-api";

interface LatestAnnouncementCardProps {
  announcement: GetLatestUnreadAnnouncementsResponse["data"][number];
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsVisible: (value: boolean) => void;
  currentIndex: number;
  announcementsCount: number;
}

export default function LatestAnnouncementCard({
  announcement,
  setCurrentIndex,
  setIsVisible,
  currentIndex,
  announcementsCount,
}: LatestAnnouncementCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isLastAnnouncement = currentIndex === announcementsCount - 1;

  const handleMarkAsRead = (id: string) => {
    markAsRead({ id });

    if (isLastAnnouncement) {
      setIsVisible(false);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleReadMore = () => {
    setIsVisible(false);
    navigate(`/announcements`);
  };

  const { mutate: markAsRead } = useMarkAnnouncementAsRead();

  return (
    <Card key={announcement.id} className="mx-1 md:mx-4">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary-100 p-2">
              <Icon name="Megaphone" className="text-primary-800" />
            </div>
            {announcementsCount > 1 && (
              <span className="text-sm text-neutral-600">
                {currentIndex + 1} of {announcementsCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="grid size-10 place-items-center rounded-lg border border-neutral-900 p-2"
              onClick={() => handleMarkAsRead(announcement.id)}
            >
              <Icon name="X" className="text-neutral-950" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <h2 className="h5 md:h4">{announcement.title}</h2>
        <p className="body-sm-md md:body-base-md text-neutral-800">
          {announcement.content.length > 200
            ? `${announcement.content.substring(0, 200)}...`
            : announcement.content}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => {
            handleMarkAsRead(announcement.id);
            handleReadMore();
          }}
        >
          {t("announcements.buttons.readMore")}
        </Button>
      </CardFooter>
    </Card>
  );
}
