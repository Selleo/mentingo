import { PasswordStrength } from "./constants";

export const getPasswordStrengthColor = (strength: PasswordStrength): string => {
  switch (strength) {
    case PasswordStrength.VERY_WEAK:
    case PasswordStrength.WEAK:
      return "bg-red-400";
    case PasswordStrength.FAIR:
    case PasswordStrength.GOOD:
      return "bg-yellow-400";
    case PasswordStrength.STRONG:
    case PasswordStrength.VERY_STRONG:
      return "bg-teal-500";
    default:
      return "bg-gray-200";
  }
};

export const getBarColor = (barIndex: number, currentStrength: PasswordStrength): string => {
  const isActive = barIndex < currentStrength;

  if (!isActive) {
    return "bg-gray-200";
  }

  return getPasswordStrengthColor(currentStrength);
};
