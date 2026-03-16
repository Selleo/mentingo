import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetAdminRegistrationFormResponse } from "~/api/generated-api";

export const ADMIN_REGISTRATION_FORM_QUERY_KEY: readonly ["adminRegistrationForm"] = [
  "adminRegistrationForm",
];

export const getAdminRegistrationFormQueryKey = () => ADMIN_REGISTRATION_FORM_QUERY_KEY;

export const adminRegistrationFormQueryOptions = () =>
  queryOptions({
    queryKey: getAdminRegistrationFormQueryKey(),
    queryFn: async () => {
      const response = await ApiClient.api.settingsControllerGetAdminRegistrationForm();

      return response.data;
    },
  });

export function useAdminRegistrationForm(enabled: boolean = true) {
  return useQuery({
    ...adminRegistrationFormQueryOptions(),
    enabled,
    select: (data: GetAdminRegistrationFormResponse) => data.data,
  });
}
