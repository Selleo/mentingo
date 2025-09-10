import { useNavigate } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMarkAnnouncementAsRead } from "~/api/mutations/useMarkAnnouncementAsRead";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";

import type { GetLatestUnreadAnnouncementsResponse } from "~/api/generated-api";

type LatestAnnouncementsPopupProps = {
  latestUnreadAnnouncements: GetLatestUnreadAnnouncementsResponse["data"];
};

export default function LatestAnnouncementsPopup({
  latestUnreadAnnouncements,
}: LatestAnnouncementsPopupProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const { mutate: markAsRead } = useMarkAnnouncementAsRead();

  if (latestUnreadAnnouncements.length === 0 || !isVisible) {
    return null;
  }

  const currentAnnouncement = latestUnreadAnnouncements[currentIndex];
  const isLastAnnouncement = currentIndex === latestUnreadAnnouncements.length - 1;

  const handleMarkAsRead = (id: string) => {
    markAsRead({ id });

    if (isLastAnnouncement) {
      setIsVisible(false);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleReadMore = () => {
    navigate(`/announcements`);
  };

  return (
    <div className="absolute z-10 mt-2 w-full space-y-4 md:mt-8">
      <Card key={currentAnnouncement.id} className="mx-1 md:mx-4">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary-100 p-2">
                <Icon name="Megaphone" className="text-primary-800" />
              </div>
              {latestUnreadAnnouncements.length > 1 && (
                <span className="text-sm text-neutral-600">
                  {currentIndex + 1} of {latestUnreadAnnouncements.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="grid size-10 place-items-center rounded-lg border border-neutral-900 p-2"
                onClick={() => handleMarkAsRead(currentAnnouncement.id)}
              >
                <Icon name="X" className="text-neutral-950" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-6 md:px-8">
          <h2 className="h5 md:h4">{currentAnnouncement.title}</h2>
          <p className="body-sm-md md:body-base-md text-neutral-800">
            {currentAnnouncement.content.length > 200
              ? `${currentAnnouncement.content.substring(0, 200)}...`
              : currentAnnouncement.content}
          </p>
        </CardContent>
        <CardFooter className="px-6 md:px-8">
          <Button
            onClick={() => {
              handleMarkAsRead(currentAnnouncement.id);
              handleReadMore();
            }}
          >
            {t("announcements.buttons.readMore")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
