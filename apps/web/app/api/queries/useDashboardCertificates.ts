import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";

import { useCurrentUser } from "./useCurrentUser";

import type { GetDashboardCertificatesResponse } from "../generated-api";

export type DashboardCertificate = GetDashboardCertificatesResponse["data"][number];

export type DashboardCertificatesResponse = GetDashboardCertificatesResponse;

const DASHBOARD_CERTIFICATES_PAGE_SIZE = 10;

export function useDashboardCertificates(page: number, enabled: boolean) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: currentUser } = useCurrentUser();

  return useQuery({
    queryKey: ["dashboard", "certificates", currentUser?.id, language, page],
    queryFn: async () => {
      if (!currentUser?.id) throw new Error(t("auth.error.unauthenticated"));
      const response = await ApiClient.api.certificatesControllerGetDashboardCertificates({
        language,
        page,
        perPage: DASHBOARD_CERTIFICATES_PAGE_SIZE,
      });
      return response.data;
    },
    enabled: enabled && Boolean(currentUser?.id),
    placeholderData: keepPreviousData,
  });
}
