import { useTranslation } from "react-i18next";

import { Skeleton } from "~/components/ui/skeleton";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

import { EmptyState } from "./CourseChatStates";

import type { CourseChatUser } from "~/api/queries/course-chat/useCourseChat";

type ChatUsersPanelProps = {
  users: CourseChatUser[];
  isLoading: boolean;
};

export function ChatUsersPanel({ users, isLoading }: ChatUsersPanelProps) {
  const { t } = useTranslation();
  const onlineCount = users.filter((user) => user.isOnline).length;

  return (
    <aside className="border-t border-neutral-200 bg-background p-4 lg:w-72 lg:border-l lg:border-t-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="body-base-md text-neutral-950">
            {t("studentCourseView.courseChat.users")}
          </h3>
          <p className="caption text-neutral-500">
            {t("studentCourseView.courseChat.onlineCount", {
              online: onlineCount,
              total: users.length,
            })}
          </p>
        </div>
      </div>

      <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : users.length ? (
          users.map((user) => {
            const userName = `${user.firstName} ${user.lastName}`;

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-50"
              >
                <div className="relative">
                  <UserAvatar
                    className="size-9"
                    userName={userName}
                    profilePictureUrl={user.avatarReference}
                  />
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
                      user.isOnline ? "bg-green-500" : "bg-neutral-300",
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <p className="body-sm-md truncate text-neutral-950">{userName}</p>
                  <p className="caption text-neutral-500">
                    {user.isOnline
                      ? t("studentCourseView.courseChat.online")
                      : t("studentCourseView.courseChat.offline")}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState text={t("studentCourseView.courseChat.emptyUsers")} />
        )}
      </div>
    </aside>
  );
}
