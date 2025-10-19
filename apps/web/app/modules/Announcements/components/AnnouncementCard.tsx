import { Link } from "@remix-run/react";
import { pl, enUS } from "date-fns/locale";
import { BookmarkCheck } from "lucide-react";
import { format } from "node_modules/date-fns/format";

import { useMarkAnnouncementAsRead } from "~/api/mutations/useMarkAnnouncementAsRead";
import { Icon } from "~/components/Icon";
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetAnnouncementsForUserResponse } from "~/api/generated-api";

interface AnnouncementCardProps {
  announcement: GetAnnouncementsForUserResponse["data"][number];
  isAdminView: boolean;
}

export default function AnnouncementCard({ announcement, isAdminView }: AnnouncementCardProps) {
  const { id, title, content, authorName, authorProfilePictureUrl, authorId, isRead, createdAt } =
    announcement;

  const { mutate: markAsRead } = useMarkAnnouncementAsRead();

  const language = useLanguageStore((state) => state.language);

  const handleMarkAsRead = () => {
    if (!isRead && !isAdminView) {
      markAsRead({ id });
    }
  };

  return (
    <Card className={cn(!isRead && "border-2 border-primary-800")} id={id}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="size-10 rounded-lg bg-primary-100 p-2">
            <Icon name="Megaphone" className="text-primary-800" />
          </div>
          {!isRead && !isAdminView && (
            <Tooltip>
              <TooltipTrigger onClick={handleMarkAsRead} className="cursor-pointer">
                <BookmarkCheck className="size-7 text-primary-800" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">{`Mark as read`}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-6 md:px-8">
        <h2 className="h5 md:h4">{title}</h2>
        <p className="body-sm md:body-base text-neutral-800">{content}</p>
      </CardContent>
      <Separator className="mb-6 bg-primary-100" />
      <CardFooter className="px-6 md:px-8">
        <div className="flex items-center gap-2">
          <UserAvatar
            userName={authorName}
            profilePictureUrl={authorProfilePictureUrl}
            className="size-8"
          />
          <Link to={`/profile/${authorId}`} className="hover:underline">
            <p className="body-sm-md md:body-base-md text-primary-800">{authorName}</p>
          </Link>
          <div className="size-1.5 rounded-full bg-neutral-800" />
          <p className="body-sm-md md:body-base-md text-neutral-800">
            {format(new Date(createdAt), "d MMM yyyy", { locale: language === "en" ? enUS : pl })}
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
