export type SessionIdentity = {
  userId: string;
  sessionId?: string;
  sessionVersion?: string;
};

export type ActiveSessionIdentity = Required<SessionIdentity>;

export type AccessTokenIdentity = SessionIdentity & { accessVersion?: string };

export type ActiveAccessTokenIdentity = ActiveSessionIdentity & { accessVersion?: string };

export type InactiveAccessTokens<T> = {
  /** Their session was revoked or expired, so only a new sign-in restores access. */
  revoked: T[];
  /** Their session is active but their access version is outdated, so a refresh restores access. */
  expired: T[];
};
