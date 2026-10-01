import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { EMAIL_TEMPLATES_QUERY_KEY } from "./useEmailTemplates";

import type { EmailTemplateEvent } from "~/modules/Admin/EmailTemplates/emailTemplates.types";

export function useEmailTemplate(id?: string, event?: EmailTemplateEvent) {
  return useQuery({
    queryKey: [...EMAIL_TEMPLATES_QUERY_KEY, "detail", id ?? event],
    enabled: Boolean(id || event),
    queryFn: async () => {
      if (id) return (await ApiClient.api.emailTemplateControllerGetEmailTemplate(id)).data.data;
      if (event)
        return (await ApiClient.api.emailTemplateControllerGetDefaultEmailTemplate(event)).data
          .data;
      throw new Error("Missing template identifier");
    },
  });
}
