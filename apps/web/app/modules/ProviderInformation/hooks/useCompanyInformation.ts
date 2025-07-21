import { queryOptions, useQuery, useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { CompanyInformationFormValues } from "../schemas/companyInformationFormSchema";

export const companyInformationQueryOptions = queryOptions({
  queryKey: ["company-information"],
  queryFn: async () => {
    const response = await ApiClient.api.settingsControllerGetCompanyInformation();
    return response.data;
  },
  staleTime: 1000 * 60 * 5,
});

export function useCompanyInformation() {
  return useQuery(companyInformationQueryOptions);
}

export function useCreateCompanyInformation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CompanyInformationFormValues) => {
      const response = await ApiClient.api.settingsControllerCreateCompanyInformation(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(companyInformationQueryOptions);
      toast({
        description: t("providerInformation.createSuccess"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message || t("providerInformation.createError"),
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCompanyInformation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CompanyInformationFormValues) => {
      const response = await ApiClient.api.settingsControllerUpdateCompanyInformation(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(companyInformationQueryOptions);
      toast({
        description: t("providerInformation.updateSuccess"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message || t("providerInformation.updateError"),
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSaveCompanyInformation() {
  const { data: existingData } = useCompanyInformation();
  const createMutation = useCreateCompanyInformation();
  const updateMutation = useUpdateCompanyInformation();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: CompanyInformationFormValues) => {
      const hasExistingData = existingData && Object.keys(existingData).length > 0;

      if (hasExistingData) {
        return updateMutation.mutateAsync(data);
      } else {
        try {
          return await createMutation.mutateAsync(data);
        } catch (error) {
          if (error instanceof AxiosError && error.response?.status === 409) {
            return updateMutation.mutateAsync(data);
          }
          throw error;
        }
      }
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message || t("providerInformation.saveError"),
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
