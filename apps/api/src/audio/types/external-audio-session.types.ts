import type { AudioOutputErrorData, LumaSocket } from "@japro/luma-sdk";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type ExternalAudioSession = {
  sessionId: string;
  socket: LumaSocket;
  currentUser: CurrentUserType;
  threadId: UUIDType;
  lessonId: UUIDType;
  userId: UUIDType;
  activeTurnId: string | null;
  audioOutputErrors: Map<string, AudioOutputErrorData>;
  pendingInterruption: boolean;
  interruptedTurnIds: Set<string>;
  activeMentorStream: {
    turnId: string;
    abortController: AbortController;
  } | null;
};
