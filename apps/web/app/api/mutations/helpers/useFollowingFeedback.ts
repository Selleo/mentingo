import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useFollowingFeedback() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return {
    showFollowingChanged: (isFollowing: boolean) =>
      toast({
        description: isFollowing
          ? t("discussionNotifications.following.toast.followed")
          : t("discussionNotifications.following.toast.unfollowed"),
      }),
    showFollowingError: (error: unknown) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("discussionNotifications.following.toast.error"),
        ),
      }),
  };
}
