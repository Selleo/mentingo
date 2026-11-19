interface FormValidationErrorProps {
  message?: string;
  testId?: string;
}

export function FormValidationError({ message, testId }: FormValidationErrorProps) {
  if (!message) return null;

  return (
    <div className="text-sm text-red-500" data-testid={testId}>
      {message}
    </div>
  );
}
