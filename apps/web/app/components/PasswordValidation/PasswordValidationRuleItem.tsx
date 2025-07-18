import { CheckIcon, XIcon } from "lucide-react";

import { cn } from "~/lib/utils";

interface PasswordValidationRuleItemProps {
  isValid: boolean;
  text: string;
}

export const PasswordValidationRuleItem = ({ isValid, text }: PasswordValidationRuleItemProps) => {
  const Icon = isValid ? CheckIcon : XIcon;
  return (
    <li className={cn("flex items-center gap-x-2", isValid && "text-teal-500")}>
      <Icon className="size-4 shrink-0" />
      {text}
    </li>
  );
};
