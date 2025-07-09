import { z } from "zod";

export const passwordValidationRules = {
  minLength: 8,
  hasUpperCase: /[A-Z]/,
  hasLowerCase: /[a-z]/,
  hasNumber: /\d/,
  hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};:'",.<>?]/,
};

export const validatePassword = (password: string) => ({
  minLength: password.length >= passwordValidationRules.minLength,
  hasUpperCase: passwordValidationRules.hasUpperCase.test(password),
  hasLowerCase: passwordValidationRules.hasLowerCase.test(password),
  hasNumber: passwordValidationRules.hasNumber.test(password),
  hasSpecialChar: passwordValidationRules.hasSpecialChar.test(password),
});

export const passwordSchema = z.object({
  oldPassword: z
    .string()
    .min(passwordValidationRules.minLength)
    .regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};:'",.<>?]).+$/),
  newPassword: z
    .string()
    .min(passwordValidationRules.minLength)
    .regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};:'",.<>?]).+$/),
});
