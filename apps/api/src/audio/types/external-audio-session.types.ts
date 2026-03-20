import type { LumaSocket } from "@japro/luma-sdk";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

export type ExternalAudioSession = {
  sessionId: string;
  socket: LumaSocket;
  currentUser: CurrentUser;
  threadId: UUIDType;
  lessonId: UUIDType;
  userId: UUIDType;
  activeTurnId: string | null;
};
