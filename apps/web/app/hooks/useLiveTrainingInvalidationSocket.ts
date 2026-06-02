import { useEffect } from "react";

import { acquireSocket, releaseSocket } from "~/api/socket";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";

const LIVE_TRAINING_INVALIDATE_SOCKET_EVENT = "live-training:invalidate";

export function useLiveTrainingInvalidationSocket() {
  useEffect(() => {
    const socket = acquireSocket();

    const handleLiveTrainingInvalidation = () => {
      void invalidateLiveTrainingData({
        includeCalendar: true,
        includeCoursesAndLessons: true,
        includeSessions: true,
      });
    };

    socket.on(LIVE_TRAINING_INVALIDATE_SOCKET_EVENT, handleLiveTrainingInvalidation);
    socket.connect();

    return () => {
      socket.off(LIVE_TRAINING_INVALIDATE_SOCKET_EVENT, handleLiveTrainingInvalidation);
      releaseSocket();
    };
  }, []);
}
