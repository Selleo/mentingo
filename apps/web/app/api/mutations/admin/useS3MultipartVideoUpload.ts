import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type {
  CompleteS3MultipartUploadBody,
  CompleteS3MultipartUploadResponse,
  SignS3MultipartPartBody,
  SignS3MultipartPartResponse,
} from "../../generated-api";

export function useSignS3MultipartPart() {
  return useMutation({
    mutationFn: async (payload: SignS3MultipartPartBody): Promise<SignS3MultipartPartResponse> => {
      const response = await ApiClient.api.fileControllerSignS3MultipartPart(payload);
      return response.data;
    },
  });
}

export function useCompleteS3MultipartUpload() {
  return useMutation({
    mutationFn: async (
      payload: CompleteS3MultipartUploadBody,
    ): Promise<CompleteS3MultipartUploadResponse> => {
      const response = await ApiClient.api.fileControllerCompleteS3MultipartUpload(payload);
      return response.data;
    },
  });
}
