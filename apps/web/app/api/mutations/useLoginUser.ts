import { useNavigate } from "@remix-run/react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { userSettingsQueryOptions } from "../queries/useUserSettings";
import { queryClient } from "../queryClient";

import type { LoginBody } from "../generated-api";

type LoginUserOptions = {
  data: LoginBody;
};

export function useLoginUser() {
  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const setCurrentUser = useCurrentUserStore(({ setCurrentUser }) => setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);
  const { toast } = useToast();

  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (options: LoginUserOptions) => {
      const response = await ApiClient.api.authControllerLogin(options.data);

      return response.data;
    },
    onSuccess: ({ data }) => {
      const { navigateTo, ...user } = data;

      navigateTo === "/" ? setHasVerifiedMFA(true) : setHasVerifiedMFA(false);

      setLoggedIn(true);
      setCurrentUser(user);
      queryClient.setQueryData(currentUserQueryOptions.queryKey, { data });
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries(userSettingsQueryOptions);
      queryClient.invalidateQueries({ queryKey: ["mfa-setup"] });

      navigate(navigateTo);
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
