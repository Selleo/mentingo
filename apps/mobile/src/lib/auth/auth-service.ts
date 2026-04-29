import { TENANT_HOST } from "@/config/env";

import { apiClient } from "./api-client";

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
};

export type LoginResult =
  | {
      status: "authenticated";
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
    }
  | {
      status: "mfaRequired";
      user: AuthUser;
      mfaChallengeToken: string;
    };

type LoginResponseData = {
  shouldVerifyMFA: boolean;
  accessToken?: string;
  refreshToken?: string;
  mfaChallengeToken?: string;
} & AuthUser;

export async function login(input: LoginInput): Promise<LoginResult> {
  const { data } = await apiClient.post<{ data: LoginResponseData }>("/auth/login", input);
  console.log(data);
  const payload = data.data;
  const { shouldVerifyMFA, accessToken, refreshToken, mfaChallengeToken, ...user } = payload;

  if (shouldVerifyMFA) {
    if (!mfaChallengeToken) {
      throw new Error("MFA required but no challenge token returned");
    }
    return { status: "mfaRequired", user: user as AuthUser, mfaChallengeToken };
  }

  if (!accessToken || !refreshToken) {
    throw new Error("Login response missing tokens");
  }

  return {
    status: "authenticated",
    user: user as AuthUser,
    accessToken,
    refreshToken,
  };
}

export async function verifyMFA(
  challengeToken: string,
  otp: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const { data } = await apiClient.post<{
    data: { isValid: boolean; accessToken?: string; refreshToken?: string };
  }>(
    "/auth/mfa/verify",
    { token: otp },
    {
      headers: {
        Authorization: `Bearer ${challengeToken}`,
        "X-Tenant-Host": TENANT_HOST,
      },
    },
  );

  const { isValid, accessToken, refreshToken } = data.data;
  if (!isValid || !accessToken || !refreshToken) {
    throw new Error("MFA verification failed");
  }
  return { accessToken, refreshToken };
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<{ data: AuthUser }>("/auth/current-user");
  return data.data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // best effort — local tokens get cleared by the caller regardless
  }
}
