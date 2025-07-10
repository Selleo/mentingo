import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  validatePassword,
  passwordValidationRules,
} from "../../modules/Dashboard/Settings/schema/password.schema";
import PasswordStrengthBars from "../PasswordStrengthBars";

import { PasswordValidationRuleItem } from "./PasswordValidationRuleItem";

interface PasswordValidationDisplayProps {
  password: string;
  onValidationChange?: (allValidationPassed: boolean) => void;
}

export default function PasswordValidationDisplay({
  password,
  onValidationChange,
}: PasswordValidationDisplayProps) {
  const { t } = useTranslation();

  const validationResult = validatePassword(password);
  const allValidationPassed = Object.values(validationResult).every(Boolean);

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(allValidationPassed);
    }
  }, [allValidationPassed, onValidationChange]);

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
      <PasswordStrengthBars password={password} />
      <div></div>
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
