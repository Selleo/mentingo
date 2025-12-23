import type { UUIDType } from "src/common";

export const getUserRoomKey = (userId: UUIDType) => `user:${userId}`;
