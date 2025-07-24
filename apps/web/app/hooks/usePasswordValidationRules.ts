import { useTranslation } from "react-i18next";

import { passwordValidationRules } from "~/modules/Auth/constants";

export function usePasswordValidationRules() {
  const { t } = useTranslation();

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

  return validationRulesConfig;
}
