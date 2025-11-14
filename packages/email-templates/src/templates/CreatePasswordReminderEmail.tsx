import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type CreatePasswordReminderEmailProps = {
  createPasswordLink: string;
} & DefaultEmailSettings;

export const CreatePasswordReminderEmail = ({
  createPasswordLink,
  primaryColor = "#4796FD",
}: CreatePasswordReminderEmailProps) => {
  return BaseEmailTemplate({
    heading: "Reminder",
    paragraphs: [
      "This is a friendly reminder that your account is not yet fully set up. 🔒",
      "To complete your account setup, please create your password by clicking the button below. If you have already created your password, please disregard this reminder.",
    ],
    buttonText: "CREATE PASSWORD",
    buttonLink: createPasswordLink,
    primaryColor,
  });
};

export default CreatePasswordReminderEmail;
