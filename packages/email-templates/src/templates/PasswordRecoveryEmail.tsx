import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type PasswordRecoveryEmailProps = {
  name: string;
  resetLink: string;
} & DefaultEmailSettings;

export const PasswordRecoveryEmail = ({
  name,
  resetLink,
  primaryColor = "#4796FD",
}: PasswordRecoveryEmailProps) => {
  return BaseEmailTemplate({
    heading: "Password Recovery",
    paragraphs: [
      `Hey ${name}, you've requested a password reset 🔑`,
      "You can reset your password using the button below.",
    ],
    buttonText: "RESET PASSWORD",
    buttonLink: resetLink,
    primaryColor,
  });
};

export default PasswordRecoveryEmail;
