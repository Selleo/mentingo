export type SessionIdentity = {
  userId: string;
  sessionId?: string;
  sessionVersion?: string;
};

export type ActiveSessionIdentity = Required<SessionIdentity>;
