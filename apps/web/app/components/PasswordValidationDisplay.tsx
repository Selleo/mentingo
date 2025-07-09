import { CheckIcon, XIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  validatePassword,
  passwordValidationRules,
} from "../modules/Dashboard/Settings/schema/password.schema";

import PasswordStrengthBars from "./PasswordStrengthBars";

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

  return (
    <div id="password-hints" className="mb-3">
      <PasswordStrengthBars password={password} />
      <div>
        <span
          data-hs-strong-password-hints-weakness-text='["Empty", "Weak", "Medium", "Strong", "Very Strong", "Super Strong"]'
          className="text-sm font-semibold text-gray-800"
        ></span>
      </div>
      <h4 className="my-2 text-sm font-semibold text-gray-800">
        {t("passwordValidationDisplay.header")}
      </h4>
      <ul className="space-y-1 text-sm text-gray-500">
        <li
          className={`${
            validationResult.minLength ? "text-teal-500" : ""
          } flex items-center gap-x-2`}
        >
          {validationResult.minLength ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <XIcon className="size-4 shrink-0" />
          )}
          {t("passwordValidationDisplay.passwordMinLength", {
            count: passwordValidationRules.minLength,
          })}
        </li>
        <li
          className={`${
            validationResult.hasLowerCase ? "text-teal-500" : ""
          } flex items-center gap-x-2`}
        >
          {validationResult.hasLowerCase ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <XIcon className="size-4 shrink-0" />
          )}
          {t("passwordValidationDisplay.passwordLowercase")}
        </li>
        <li
          className={`${
            validationResult.hasUpperCase ? "text-teal-500" : ""
          } flex items-center gap-x-2`}
        >
          {validationResult.hasUpperCase ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <XIcon className="size-4 shrink-0" />
          )}
          {t("passwordValidationDisplay.passwordUppercase")}
        </li>
        <li
          className={`${
            validationResult.hasNumber ? "text-teal-500" : ""
          } flex items-center gap-x-2`}
        >
          {validationResult.hasNumber ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <XIcon className="size-4 shrink-0" />
          )}
          {t("passwordValidationDisplay.passwordNumber")}
        </li>
        <li
          className={`${
            validationResult.hasSpecialChar ? "text-teal-500" : ""
          } flex items-center gap-x-2`}
        >
          {validationResult.hasSpecialChar ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <XIcon className="size-4 shrink-0" />
          )}
          {t("passwordValidationDisplay.passwordSpecial")}
        </li>
      </ul>
    </div>
  );
}
