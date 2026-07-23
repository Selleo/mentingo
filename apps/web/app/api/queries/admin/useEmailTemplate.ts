import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetTemplateResponse } from "~/api/generated-api";

export const EMAIL_TEMPLATE_QUERY_KEY = "email-template";

type QueryOptions = {
  enabled?: boolean;
};

export const emailTemplateOptions = (id: string, options: QueryOptions = { enabled: true }) => ({
  queryKey: [EMAIL_TEMPLATE_QUERY_KEY, id],
  queryFn: async () => {
    const { data } = await ApiClient.api.emailNotificationTemplatesControllerGetTemplate(id);
    return data;
  },
  select: (data: GetTemplateResponse) => data.data,
  ...options,
});

export function useEmailTemplate(id: string, options?: QueryOptions) {
  return useQuery(emailTemplateOptions(id, options));
}

export function useEmailTemplateSuspense(id: string) {
  return useSuspenseQuery(emailTemplateOptions(id));
}
