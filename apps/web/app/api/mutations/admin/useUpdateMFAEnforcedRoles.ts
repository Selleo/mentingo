import { useLocation, useNavigate } from "@remix-run/react";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { authSessionQueryOptions } from "~/api/queries/useAuthSession";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { MFA_URL } from "~/modules/Auth/constants";

import type { UpdateMFAEnforcedRolesBody } from "~/api/generated-api";

export function useUpdateMFAEnforcedRoles() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );

  return useMutation({
    mutationFn: async (data: UpdateMFAEnforcedRolesBody) => {
      const response = await ApiClient.api.settingsControllerUpdateMfaEnforcedRoles(data);
      return response.data;
    },
    onSuccess: async () => {
      const session = await queryClient.fetchQuery({ ...authSessionQueryOptions, staleTime: 0 });

      if (session?.status === AUTH_SESSION_STATUS.MFA_REQUIRED) {
        addLastUnauthorizedEntry({ pathname: `${pathname}${search}`, timestamp: Date.now() });
        toast({ description: t("MFAEnforcementView.toast.mfaVerificationRequired") });
        navigate(MFA_URL, { replace: true });
        return;
      }

      queryClient.invalidateQueries(globalSettingsQueryOptions);
      toast({
        variant: "default",
        description: t("MFAEnforcementView.toast.mfaEnforcementUpdatedSuccessfully"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("MFAEnforcementView.toast.mfaEnforcementUpdateFailed"),
      });
    },
  });
}
