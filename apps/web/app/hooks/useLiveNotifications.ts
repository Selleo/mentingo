import { NOTIFICATION_SOCKET_EVENTS } from "@repo/shared";
import { useEffect } from "react";

import { acquireSocket, releaseSocket } from "~/api/socket";
import { invalidateNotificationsData } from "~/api/utils/invalidateNotificationsData";

export function useLiveNotifications() {
  useEffect(() => {
    const socket = acquireSocket();

    const refreshNotifications = () => {
      void invalidateNotificationsData();
    };
    let hasConnected = socket.connected;
    const handleConnect = () => {
      if (hasConnected) refreshNotifications();

      hasConnected = true;
    };

    socket.on("connect", handleConnect);
    socket.on(NOTIFICATION_SOCKET_EVENTS.CREATED, refreshNotifications);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(NOTIFICATION_SOCKET_EVENTS.CREATED, refreshNotifications);
      releaseSocket();
    };
  }, []);
}
