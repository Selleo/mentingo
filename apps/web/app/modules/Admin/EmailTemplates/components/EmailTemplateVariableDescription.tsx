import { useTranslation } from "react-i18next";

type EmailTemplateVariableDescriptionProps = {
  variableKey: string;
};

export function EmailTemplateVariableDescription({
  variableKey,
}: EmailTemplateVariableDescriptionProps) {
  const { t } = useTranslation();
  const description = t(`emailTemplates.variableDescriptions.${variableKey}`, { defaultValue: "" });
  if (!description) return null;

  return (
    <span className="mb-3 flex max-w-xs gap-1 whitespace-normal font-sans text-xs font-normal leading-relaxed text-neutral-600">
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
      <span>{description}</span>
    </span>
  );
}
