import { AxiosError } from "axios";

import type { TFunction } from "i18next";
import type { ApiErrorResponse } from "~/api/types";

type ApiErrorResponseWithCount = ApiErrorResponse & {
  count?: number;
};

const getFirstMessage = (message?: string | string[]) =>
  Array.isArray(message) ? message[0] : message;

export const getTranslatedApiErrorMessage = (error: unknown, t: TFunction, fallback: string) => {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as ApiErrorResponseWithCount | undefined;
    const message = getFirstMessage(responseData?.message);

    if (message) return t(message, { count: responseData?.count });
  }

  if (error instanceof Error && error.message) return error.message;

  return fallback;
};
