import { t } from "i18next";

import { toast } from "~/components/ui/use-toast";

import type { ApiError } from "~/api/types";

export const API_ERROR_MESSAGE_KEYS = {
  TENANT_INACTIVE: "tenant.error.inactive",
  MISSING_PERMISSION: "auth.error.missingPermission",
  TOO_MANY_REQUESTS: "common.toast.tooManyRequests",
  USER_NOT_FOUND: "adminUserView.error.userNotFound",
} as const;

const TENANT_INACTIVE_PATH = "/tenant-inactive";

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
