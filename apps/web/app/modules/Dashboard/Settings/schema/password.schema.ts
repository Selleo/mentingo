import { z } from "zod";

import { passwordValidationRules } from "~/modules/Auth/constants";

export const passwordSchema = z
  .string()
  .min(passwordValidationRules.minLength, "passwordValidation.minLength")
  .refine(
    (password) => passwordValidationRules.hasUpperCase.test(password),
    "passwordValidation.hasUpperCase",
  )
  .refine(
    (password) => passwordValidationRules.hasLowerCase.test(password),
    "passwordValidation.hasLowerCase",
  )
  .refine(
    (password) => passwordValidationRules.hasNumber.test(password),
    "passwordValidation.hasNumber",
  )
  .refine(
    (password) => passwordValidationRules.hasSpecialChar.test(password),
    "passwordValidation.hasSpecialChar",
  );

export const validatePasswordStrength = (password: string) => ({
  minLength: password.length >= passwordValidationRules.minLength,
  hasUpperCase: passwordValidationRules.hasUpperCase.test(password),
  hasLowerCase: passwordValidationRules.hasLowerCase.test(password),
  hasNumber: passwordValidationRules.hasNumber.test(password),
  hasSpecialChar: passwordValidationRules.hasSpecialChar.test(password),
});
