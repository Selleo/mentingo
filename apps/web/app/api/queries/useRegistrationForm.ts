import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetPublicRegistrationFormResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const REGISTRATION_FORM_QUERY_KEY = "registrationForm";

export const getRegistrationFormQueryKey = (language: SupportedLanguages) => [
  REGISTRATION_FORM_QUERY_KEY,
  language,
];

export const registrationFormQueryOptions = (language: SupportedLanguages) =>
  queryOptions({
    queryKey: getRegistrationFormQueryKey(language),
    queryFn: async () => {
      const { data } = await ApiClient.api.settingsControllerGetPublicRegistrationForm({
        language,
      });

      return data;
    },
  });

export function useRegistrationForm(language: SupportedLanguages) {
  return useQuery({
    ...registrationFormQueryOptions(language),
    select: (data: GetPublicRegistrationFormResponse) => data.data,
  });
}
