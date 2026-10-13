import { Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import { AutomationSearchSelect } from "../../Automations/Builder/components/AutomationSearchSelect";

import type { EmailTemplateVariables } from "../emailTemplates.types";

interface EmailTemplateButtonLinkProps {
  value: string;
  variables: EmailTemplateVariables;
  disabled: boolean;
  onChange: (value: string) => void;
}

const CUSTOM_LINK_OPTION = "custom_url";

export function EmailTemplateButtonLink({
  value,
  variables,
  disabled,
  onChange,
}: EmailTemplateButtonLinkProps) {
  const { t } = useTranslation();
  const linkVariables = variables.filter((variable) => variable.type === "url");
  const tokenName = value
    .trim()
    .match(/^{{\s*([^{}]+?)\s*}}$/)?.[1]
    .trim();
  const selectedVariable = linkVariables.find((variable) => variable.key === tokenName);

  return (
    <div className="space-y-2">
      <p className="text-xs">{t("emailTemplates.ui.buttonLink")}</p>
      <div className="overflow-hidden rounded-lg border border-input bg-white transition-colors focus-within:border-primary-400 [&_button[role=combobox]]:h-9 [&_button[role=combobox]]:rounded-none [&_button[role=combobox]]:border-0 [&_button[role=combobox]]:bg-transparent [&_button[role=combobox]]:text-xs [&_button[role=combobox]]:shadow-none">
        <AutomationSearchSelect
          value={selectedVariable ? `tag:${selectedVariable.key}` : CUSTOM_LINK_OPTION}
          label={t("emailTemplates.ui.buttonLink")}
          placeholder={t("emailTemplates.ui.buttonLink")}
          disabled={disabled}
          groups={[
            {
              label: t("emailTemplates.ui.variables"),
              options: linkVariables.map((variable) => ({
                value: `tag:${variable.key}`,
                label: variable.label,
                description: `{{${variable.key}}}`,
              })),
            },
            {
              options: [
                { value: CUSTOM_LINK_OPTION, label: t("emailTemplates.ui.customButtonLink") },
              ],
            },
          ]}
          onValueChange={(selection) => {
            if (selection === CUSTOM_LINK_OPTION) {
              if (selectedVariable) onChange("");

              return;
            }

            const variable = linkVariables.find((variable) => `tag:${variable.key}` === selection);

            if (variable) onChange(`{{${variable.key}}}`);
          }}
        />
        {!selectedVariable && (
          <div className="relative border-t border-neutral-100 bg-neutral-50/60">
            <Link2
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <Input
              data-testid={EMAIL_TEMPLATES_HANDLES.BUTTON_URL}
              aria-label={t("emailTemplates.ui.buttonLink")}
              className="h-9 rounded-none border-0 bg-transparent pl-9 text-xs shadow-none focus-visible:ring-0"
              placeholder="https://"
              value={value}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
