import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const EMAIL_TEMPLATES_QUERY_KEY = ["email-templates"] as const;
export function useEmailTemplates(page: number, perPage: number) {
  return useQuery({
    queryKey: [...EMAIL_TEMPLATES_QUERY_KEY, "list", page, perPage],
    queryFn: async () =>
      (await ApiClient.api.emailTemplateControllerGetEmailTemplates({ page, perPage })).data,
  });
}
