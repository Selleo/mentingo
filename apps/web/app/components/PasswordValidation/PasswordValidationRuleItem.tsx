import { CheckIcon, XIcon } from "lucide-react";

interface PasswordValidationRuleItemProps {
  isValid: boolean;
  text: string;
}

export const PasswordValidationRuleItem = ({ isValid, text }: PasswordValidationRuleItemProps) => {
  return (
    <li className={`${isValid ? "text-teal-500" : ""} flex items-center gap-x-2`}>
      {isValid ? <CheckIcon className="size-4 shrink-0" /> : <XIcon className="size-4 shrink-0" />}
      {text}
    </li>
  );
};
