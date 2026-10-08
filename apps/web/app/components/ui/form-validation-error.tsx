interface FormValidationErrorProps {
  message?: string;
}

export function FormValidationError({ message }: FormValidationErrorProps) {
  if (!message) return null;

  return <div className="text-sm text-red-500 mono:text-xs mono:text-error-500">{message}</div>;
}
