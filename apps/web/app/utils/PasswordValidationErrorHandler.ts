import type { AxiosError } from "axios";

interface PasswordValidationError {
  type: number;
  schema?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    errorMessage?: string;
    type?: string;
    allOf?: unknown[];
  };
  path: string;
  value: unknown;
  message: string;
}

interface PasswordValidationErrorResponse {
  errors: PasswordValidationError[];
  message: string;
}

export const extractPasswordValidationErrors = (error: AxiosError): string => {
  const errorData = error.response?.data as PasswordValidationErrorResponse;
  const errors = errorData?.errors || [];
  const errorMessages: string[] = [];

  errors.forEach((err: PasswordValidationError) => {
    if (err.schema?.errorMessage) {
      errorMessages.push(err.schema.errorMessage);
    }
  });

  const uniqueMessages = [...new Set(errorMessages)];
  const joinedMessages = uniqueMessages.join("\n");

  return joinedMessages || errorData?.message || error.message || "Unknown error";
};
