import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { usePasswordValidationRules } from "~/hooks/usePasswordValidationRules";

import { validatePasswordStrength } from "../../modules/Dashboard/Settings/schema/password.schema";
import PasswordStrengthBars from "../PasswordStrengthBars";

import { PasswordValidationRuleItem } from "./PasswordValidationRuleItem";

interface PasswordValidationDisplayProps {
  fieldName: string;
}

export default function PasswordValidationDisplay({ fieldName }: PasswordValidationDisplayProps) {
  const { watch } = useFormContext();
  const validationRulesConfig = usePasswordValidationRules();

  const { t } = useTranslation();

  const password = watch(fieldName) || "";
  const validationResult = validatePasswordStrength(password);

  return (
    <div id="password-hints" className="mb-3">
      <PasswordStrengthBars fieldName={fieldName} />
      <h4 className="my-2 text-sm font-semibold text-gray-800">
        {t("passwordValidationDisplay.title")}
      </h4>
      <ul className="space-y-1 text-sm text-gray-500">
        {validationRulesConfig.map((rule) => (
          <PasswordValidationRuleItem
            key={rule.key}
            isValid={validationResult[rule.key as keyof typeof validationResult]}
            text={rule.getText()}
          />
        ))}
      </ul>
    </div>
  );
}
