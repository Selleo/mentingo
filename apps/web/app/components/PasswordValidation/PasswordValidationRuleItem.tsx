import { CheckIcon, XIcon } from "lucide-react";

import { cn } from "~/lib/utils";

interface PasswordValidationRuleItemProps {
  isValid: boolean;
  text: string;
}

export const PasswordValidationRuleItem = ({ isValid, text }: PasswordValidationRuleItemProps) => {
  const Icon = isValid ? CheckIcon : XIcon;
  return (
    <li
      className={cn("flex items-center gap-x-2", {
        "text-teal-500": isValid,
      })}
    >
      <Icon className="size-4 shrink-0" />
      {text}
    </li>
  );
};
