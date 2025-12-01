import { getPasswordRecoveryEmailTranslations } from "translations/passwordRecovery";
import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type PasswordRecoveryEmailProps = {
  name: string;
  resetLink: string;
} & DefaultEmailSettings;

export const PasswordRecoveryEmail = ({
  name,
  resetLink,
  primaryColor,
  language = "en",
}: PasswordRecoveryEmailProps) => {
  const { heading, paragraphs, buttonText } = getPasswordRecoveryEmailTranslations(language, name);

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: resetLink,
    primaryColor,
  });
};

export default PasswordRecoveryEmail;
