import type { Socket } from "socket.io";

export interface HeartbeatPayload {
  lessonId: string;
  courseId: string;
  timestamp: number;
  isActive: boolean;
}

export interface JoinLessonPayload {
  lessonId: string;
  courseId: string;
}

export interface LeaveLessonPayload {
  lessonId: string;
}

export interface WsUser {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

export type AuthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  { user: WsUser }
>;
