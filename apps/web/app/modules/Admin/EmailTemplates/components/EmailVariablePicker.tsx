import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { EmailTemplateVariableDescription } from "./EmailTemplateVariableDescription";

import type { EmailTemplateVariables } from "../emailTemplates.types";

export type EmailVariablePickerProps = {
  variables: EmailTemplateVariables;
  onInsert: (token: string) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function EmailVariablePicker({
  variables,
  onInsert,
  disabled = false,
  compact = false,
}: EmailVariablePickerProps) {
  const { t } = useTranslation();
  return (
    <Select value="" disabled={disabled} onValueChange={(key) => onInsert(`{{ ${key} }}`)}>
      <SelectTrigger
        className={cn("w-full", { "sm:w-52": !compact })}
        aria-label={t("emailTemplates.ui.insertVariable")}
      >
        <SelectValue placeholder={t("emailTemplates.ui.insertVariable")} />
      </SelectTrigger>
      <SelectContent>
        {variables.map((variable) => (
          <SelectItem key={variable.key} value={variable.key}>
            <span className="block">
              {variable.key}
              {variable.requiredInTemplate ? " *" : ""}
            </span>
            <EmailTemplateVariableDescription variableKey={variable.key} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
