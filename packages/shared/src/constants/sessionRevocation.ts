export const SESSION_REVOCATION_SOCKET = {
  EVENTS: {
    PERMISSIONS_UPDATED: "permissions-updated",
  },
  REASONS: {
    ROLES_CHANGED: "roles_changed",
  },
  MESSAGE_KEYS: {
    PERMISSIONS_UPDATED: "sessionRevocation.permissionsUpdated",
  },
} as const;

export type SessionRevocationSocketEvent =
  (typeof SESSION_REVOCATION_SOCKET.EVENTS)[keyof typeof SESSION_REVOCATION_SOCKET.EVENTS];
