import { AxiosError } from "axios";

import type { TFunction } from "i18next";
import type { ApiErrorResponse } from "~/api/types";

type ApiErrorResponseWithCount = ApiErrorResponse & {
  count?: number;
};

const getFirstMessage = (message?: string | string[]) =>
  Array.isArray(message) ? message[0] : message;

export const getTranslatedApiErrorMessage = (
  error: unknown,
  t: TFunction,
  fallback: string,
  { allowUntranslatedMessage = true }: { allowUntranslatedMessage?: boolean } = {},
) => {
  if (typeof error === "string" && error.trim()) {
    return t(error, { defaultValue: allowUntranslatedMessage ? error : fallback });
  }

  if (error instanceof AxiosError) {
    const responseData = error.response?.data as ApiErrorResponseWithCount | undefined;
    const message = getFirstMessage(responseData?.message);

    if (message) {
      return t(message, {
        count: responseData?.count,
        ...responseData?.translationParams,
        defaultValue: allowUntranslatedMessage ? message : fallback,
      });
    }
  }

  if (error instanceof Error && error.message) {
    return t(error.message, { defaultValue: allowUntranslatedMessage ? error.message : fallback });
  }

  return fallback;
};
