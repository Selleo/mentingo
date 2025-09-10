import { useNavigate } from "@remix-run/react";
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

  const { mutate: markAsRead } = useMarkAnnouncementAsRead();

  const handleMarkAsRead = (id: string) => {
    markAsRead({ id });
  };

  const handleReadMore = (id: string) => {
    markAsRead({ id });
    navigate(`/announcements`);
  };

  return (
    <div className="absolute z-10 mt-2 w-full space-y-4 md:mt-8">
      {latestUnreadAnnouncements.map((announcement) => (
        <Card key={announcement.id} className="mx-1 md:mx-4">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-lg bg-primary-100 p-2">
                <Icon name="Megaphone" className="text-primary-800" />
              </div>
              <Button
                variant="ghost"
                className="grid size-10 place-items-center rounded-lg border border-neutral-900 p-2"
                onClick={() => handleMarkAsRead(announcement.id)}
              >
                <Icon name="X" className="text-neutral-950" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-6 md:px-8">
            <h2 className="h5 md:h4">{announcement.title}</h2>
            <p className="body-sm-md md:body-base-md text-neutral-800">
              {announcement.content.length > 200
                ? `${announcement.content.substring(0, 200)}...`
                : announcement.content}
            </p>
          </CardContent>
          <CardFooter className="px-6 md:px-8">
            <Button onClick={() => handleReadMore(announcement.id)}>
              {t("announcements.buttons.readMore")}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
