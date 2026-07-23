import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { EmailTemplateStatus } from "@repo/shared";
import type { ListTemplatesResponse } from "~/api/generated-api";

export const ALL_EMAIL_TEMPLATES_QUERY_KEY = "email-templates";

export type AllEmailTemplatesParams = {
  status?: EmailTemplateStatus;
  name?: string;
  page?: number;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

export const allEmailTemplatesOptions = (
  searchParams?: AllEmailTemplatesParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [ALL_EMAIL_TEMPLATES_QUERY_KEY, searchParams],
  queryFn: async () => {
    const { data } = await ApiClient.api.emailNotificationTemplatesControllerListTemplates({
      ...(searchParams?.status && { status: searchParams.status }),
      ...(searchParams?.name && { name: searchParams.name }),
      ...(searchParams?.page && { page: searchParams.page }),
      ...(searchParams?.perPage && { perPage: searchParams.perPage }),
    });

    return data;
  },
  select: (data: ListTemplatesResponse) => data.data,
  ...options,
});

export function useAllEmailTemplates(
  searchParams?: AllEmailTemplatesParams,
  options?: QueryOptions,
) {
  return useQuery(allEmailTemplatesOptions(searchParams, options));
}

export function useAllEmailTemplatesSuspense(searchParams?: AllEmailTemplatesParams) {
  return useSuspenseQuery(allEmailTemplatesOptions(searchParams));
}
