import { REWARDS_SOCKET_EVENTS } from "@repo/shared";
import { useEffect } from "react";

import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";

export function useRewardNotifications() {
  useEffect(() => {
    const socket = acquireSocket();
    const handleConnect = () => socket.emit("join:user");
    const handleRewardsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
    };

    socket.on("connect", handleConnect);
    socket.on(REWARDS_SOCKET_EVENTS.UPDATED, handleRewardsUpdated);
    socket.connect();

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(REWARDS_SOCKET_EVENTS.UPDATED, handleRewardsUpdated);
      releaseSocket();
    };
  }, []);
}
