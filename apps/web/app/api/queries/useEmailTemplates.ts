import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export const EMAIL_TEMPLATES_QUERY_KEY = ["email-templates"] as const;
export function useEmailTemplates(page: number, perPage: number, search = "") {
  const language = useLanguageStore((state) => state.language);
  const normalizedSearch = search.trim();

  return useQuery({
    queryKey: [...EMAIL_TEMPLATES_QUERY_KEY, "list", page, perPage, normalizedSearch, language],
    queryFn: async ({ signal }) =>
      (
        await ApiClient.api.emailTemplateManagementControllerListEmailTemplates(
          { page, perPage, search: normalizedSearch || undefined, language },
          { signal },
        )
      ).data,
  });
}
