import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type {
  CommitScormAttemptBody,
  FinishScormAttemptBody,
  RequestParams,
} from "../generated-api";

type ScormRuntimeMutationOptions<TBody> = {
  data: TBody;
  params?: RequestParams;
};

export function useCommitScormRuntime() {
  return useMutation({
    mutationFn: async ({ data, params }: ScormRuntimeMutationOptions<CommitScormAttemptBody>) => {
      const response = await ApiClient.api.scormControllerCommitScormAttempt(data, params);

      return response.data.data;
    },
  });
}

export function useFinishScormRuntime() {
  return useMutation({
    mutationFn: async ({ data, params }: ScormRuntimeMutationOptions<FinishScormAttemptBody>) => {
      const response = await ApiClient.api.scormControllerFinishScormAttempt(data, params);

      return response.data.data;
    },
  });
}
