import type { AUTH_TOKEN_VERSION } from "./session.constants";
import type { AuthTokenPurpose } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { UserLoginMethod } from "src/events/user/user-login.event";

export type AuthContext = {
  sessionId?: string;
  sessionVersion?: string;
  loginMethod?: UserLoginMethod;
  rememberMe?: boolean;
  mfaVerified?: boolean;
};

export type SessionClaims = CurrentUserType & {
  tokenVersion: typeof AUTH_TOKEN_VERSION;
  tokenPurpose: AuthTokenPurpose;
  mfaVerified: boolean;
  jti: string;
  sessionVersion: string;
  exp: number;
};

export type MfaChallengeIdentity = {
  userId: string;
  tenantId: string;
  email: string;
};

export type MfaChallenge = AuthContext & MfaChallengeIdentity;

export type MfaChallengeKeyOwner = {
  tenantId: string;
  userId: string;
  jti?: string;
};

export type MfaPolicy = {
  required: boolean;
  enabled: boolean;
  secret: string | null;
};

export type SupportMfaAssurance = {
  userId: string;
  sessionId: string;
  sessionVersion: string;
  mfaVerified: boolean;
};
