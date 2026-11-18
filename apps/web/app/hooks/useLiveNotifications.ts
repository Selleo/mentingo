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

    const handleConnect = () => {
      socket.emit("join:user");
      refreshNotifications();
    };

    socket.on("connect", handleConnect);
    socket.on(NOTIFICATION_SOCKET_EVENTS.CREATED, refreshNotifications);
    socket.connect();

    if (socket.connected) socket.emit("join:user");

    return () => {
      socket.off("connect", handleConnect);
      socket.off(NOTIFICATION_SOCKET_EVENTS.CREATED, refreshNotifications);
      releaseSocket();
    };
  }, []);
}
