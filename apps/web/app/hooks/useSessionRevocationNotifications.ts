import { SESSION_REVOCATION_SOCKET } from "@repo/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { currentUserQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";
import { authService } from "~/modules/Auth/authService";

type SessionRevocationNotification = {
  reason: (typeof SESSION_REVOCATION_SOCKET.REASONS)[keyof typeof SESSION_REVOCATION_SOCKET.REASONS];
  messageKey?: string;
};

export function useSessionRevocationNotifications() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const [isRefreshingPermissions, setIsRefreshingPermissions] = useState(false);

  useEffect(() => {
    const socket = acquireSocket();

    const handleConnect = () => socket.emit("join:user");

    socket.on("connect", handleConnect);

    socket.connect();

    if (socket.connected) handleConnect();

    const handlePermissionsUpdated = async (notification: SessionRevocationNotification) => {
      if (isRefreshingPermissions) return;

      setIsRefreshingPermissions(true);

      toast({
        description: t(
          notification.messageKey ?? SESSION_REVOCATION_SOCKET.MESSAGE_KEYS.PERMISSIONS_UPDATED,
        ),
      });

      try {
        await authService.refreshToken();
        await queryClient.invalidateQueries({ queryKey: currentUserQueryOptions.queryKey });
      } catch {
        toast({
          description: t("sessionRevocation.refreshFailed"),
          duration: Number.POSITIVE_INFINITY,
          variant: "destructive",
        });
      } finally {
        setIsRefreshingPermissions(false);
      }
    };

    socket.on(SESSION_REVOCATION_SOCKET.EVENTS.PERMISSIONS_UPDATED, handlePermissionsUpdated);

    return () => {
      socket.off("connect", handleConnect);
      socket.off(SESSION_REVOCATION_SOCKET.EVENTS.PERMISSIONS_UPDATED, handlePermissionsUpdated);
      releaseSocket();
    };
  }, [toast, t, isRefreshingPermissions]);
}
