import { Bell, BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

type FollowDiscussionButtonProps = {
  isFollowing: boolean;
  isPending: boolean;
  onToggle: () => void;
  compact?: boolean;
  testId?: string;
};

export function FollowDiscussionButton({
  isFollowing,
  isPending,
  onToggle,
  compact = false,
  testId,
}: FollowDiscussionButtonProps) {
  const { t } = useTranslation();
  const FollowIcon = isFollowing ? Bell : BellOff;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={compact ? "ghost" : "outline"}
            size="sm"
            aria-pressed={isFollowing}
            disabled={isPending}
            data-testid={testId}
            className={cn("shrink-0 gap-1.5", {
              "h-6 px-2 text-xs text-neutral-600": compact,
              "text-primary-700": compact && isFollowing,
            })}
            onClick={onToggle}
          >
            <FollowIcon className={cn(compact ? "size-3.5" : "size-4")} aria-hidden />
            {isFollowing
              ? t("discussionNotifications.following.following")
              : t("discussionNotifications.following.follow")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isFollowing
            ? t("discussionNotifications.following.unfollowHint")
            : t("discussionNotifications.following.followHint")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
