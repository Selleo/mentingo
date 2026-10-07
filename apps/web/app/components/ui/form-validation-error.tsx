import { IS_MONO_DESIGN } from "~/config/designVariant";
import { cn } from "~/lib/utils";

interface FormValidationErrorProps {
  message?: string;
}

export function FormValidationError({ message }: FormValidationErrorProps) {
  if (!message) return null;

  return (
    <div className={cn("text-sm text-red-500", IS_MONO_DESIGN && "text-xs text-error-500")}>
      {message}
    </div>
  );
}
