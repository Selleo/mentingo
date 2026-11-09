import { AUTH_ERROR_KEYS } from "@repo/shared";
import { t } from "i18next";

import { AUTH_QUERY_KEYS } from "~/api/queries/auth.keys";
import { queryClient } from "~/api/queryClient";
import { toast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { LOGIN_URL, MFA_URL } from "~/modules/Auth/constants";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { ApiError } from "~/api/types";

export const API_ERROR_MESSAGE_KEYS = {
  TENANT_INACTIVE: "tenant.error.inactive",
  MISSING_PERMISSION: "auth.error.missingPermission",
  TOO_MANY_REQUESTS: "common.toast.tooManyRequests",
  USER_NOT_FOUND: "adminUserView.error.userNotFound",
  MFA_REQUIRED: AUTH_ERROR_KEYS.MFA_REQUIRED,
} as const;

const TENANT_INACTIVE_PATH = "/tenant-inactive";
const MFA_ENDPOINT_PATH = "/mfa/";

export const hasApiErrorMessage = (error: ApiError, status: number, messageKey: string) =>
  error.response?.status === status && error.response.data?.message === messageKey;

export const translateRateLimitMessage = (error: ApiError) => {
  if (!error.response) return;

  const payload = error.response.data;

  error.response.data = {
    ...payload,
    message: t(API_ERROR_MESSAGE_KEYS.TOO_MANY_REQUESTS, {
      seconds: payload.retryAfterSeconds ?? 60,
    }),
  };
};

export const redirectToTenantInactivePage = () => {
  if (typeof window === "undefined" || window.location.pathname === TENANT_INACTIVE_PATH) return;

  window.location.href = TENANT_INACTIVE_PATH;
};

export const showMissingPermissionToast = () =>
  toast({
    description: t(API_ERROR_MESSAGE_KEYS.MISSING_PERMISSION),
    variant: "destructive",
  });

export const redirectToMfaVerification = (error: ApiError) => {
  useAuthStore.setState({ isLoggedIn: false });
  useCurrentUserStore.setState({ currentUser: undefined });
  queryClient.setQueryData(AUTH_QUERY_KEYS.CURRENT_USER, null);
  void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.SESSION, refetchType: "none" });

  if (typeof window === "undefined" || window.location.pathname === MFA_URL) return;

  window.location.assign(error.response?.data?.redirectUrl ?? MFA_URL);
};

export const isExpiredMfaChallenge = (error: ApiError) =>
  error.response?.status === 401 && Boolean(error.config?.url?.includes(MFA_ENDPOINT_PATH));

export const redirectToLoginAfterMfaExpiry = () => {
  queryClient.setQueryData(AUTH_QUERY_KEYS.SESSION, null);

  if (typeof window !== "undefined") window.location.assign(LOGIN_URL);
};
