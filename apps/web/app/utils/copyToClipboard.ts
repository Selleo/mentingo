import { toast } from "~/components/ui/use-toast";

export const copyToClipboard = (text: string, successMessage: string, errorMessage: string) => {
  navigator.clipboard.writeText(text).then(
    () => {
      return toast({
        variant: "default",
        description: successMessage,
      });
    },
    () => {
      return toast({
        variant: "destructive",
        description: errorMessage,
      });
    },
  );
};
