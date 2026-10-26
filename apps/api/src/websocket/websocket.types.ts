import type { PermissionKey } from "@repo/shared";
import type { Socket } from "socket.io";

export interface HeartbeatPayload {
  learningStateId?: string | null;
  lessonId: string;
  courseId: string;
  timestamp: number;
  isActive: boolean;
}

export interface JoinLessonPayload {
  learningStateId?: string | null;
  lessonId: string;
  courseId: string;
}

export interface LeaveLessonPayload {
  learningStateId?: string | null;
  lessonId: string;
}

export interface JoinLiveTrainingPayload {
  liveTrainingId: string;
}

export interface LeaveLiveTrainingPayload {
  liveTrainingId: string;
}

export interface WsUser {
  userId: string;
  email: string;
  roleSlugs: string[];
  permissions: PermissionKey[];
  tenantId: string;
}

export type AuthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  { user: WsUser }
>;
