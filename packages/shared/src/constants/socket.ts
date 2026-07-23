export const USER_SOCKET_EVENTS = {
  JOIN: "join:user",
  LEAVE: "leave:user",
} as const;

export type UserSocketEvent = (typeof USER_SOCKET_EVENTS)[keyof typeof USER_SOCKET_EVENTS];
