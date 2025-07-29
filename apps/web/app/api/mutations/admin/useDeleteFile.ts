import { useMutation } from "@tanstack/react-query";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

export function useDeleteFile() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fileKey: string) => {
      return await ApiClient.api.fileControllerDeleteFile({
        fileKey,
      });
    },
    onSuccess: () => {
      toast({ description: "File deleted successfully" });
    },
    onError: (error) => {
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
