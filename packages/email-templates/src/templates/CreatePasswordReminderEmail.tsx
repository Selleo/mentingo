import { getCreatePasswordReminderEmailTranslations } from "translations/createPasswordReminder";
import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type CreatePasswordReminderEmailProps = {
  createPasswordLink: string;
} & DefaultEmailSettings;

export const CreatePasswordReminderEmail = ({
  createPasswordLink,
  primaryColor,
  language = "en",
}: CreatePasswordReminderEmailProps) => {
  const { heading, paragraphs, buttonText } = getCreatePasswordReminderEmailTranslations(language);

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: createPasswordLink,
    primaryColor,
  });
};

export default CreatePasswordReminderEmail;
