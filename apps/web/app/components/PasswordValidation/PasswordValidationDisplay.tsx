import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { passwordValidationRules } from "~/modules/Auth/constants";

import { validatePasswordStrength } from "../../modules/Dashboard/Settings/schema/password.schema";
import PasswordStrengthBars from "../PasswordStrengthBars";

import { PasswordValidationRuleItem } from "./PasswordValidationRuleItem";

interface PasswordValidationDisplayProps {
  fieldName: string;
}

export default function PasswordValidationDisplay({ fieldName }: PasswordValidationDisplayProps) {
  const { t } = useTranslation();
  const { watch } = useFormContext();

  const password = watch(fieldName) || "";
  const validationResult = validatePasswordStrength(password);

  const validationRulesConfig = [
    {
      key: "minLength",
      getText: () =>
        t("passwordValidationDisplay.passwordMinLength", {
          count: passwordValidationRules.minLength,
        }),
    },
    {
      key: "hasLowerCase",
      getText: () => t("passwordValidationDisplay.passwordLowercase"),
    },
    {
      key: "hasUpperCase",
      getText: () => t("passwordValidationDisplay.passwordUppercase"),
    },
    {
      key: "hasNumber",
      getText: () => t("passwordValidationDisplay.passwordNumber"),
    },
    {
      key: "hasSpecialChar",
      getText: () => t("passwordValidationDisplay.passwordSpecial"),
    },
  ];

  return (
    <div id="password-hints" className="mb-3">
      <PasswordStrengthBars fieldName={fieldName} />
      <h4 className="my-2 text-sm font-semibold text-gray-800">
        {t("passwordValidationDisplay.header")}
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
