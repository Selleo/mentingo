import { getNewUserEmailTranslations } from "translations/newUser";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type NewUserEmailProps = {
  userName: string;
  profileLink: string;
} & DefaultEmailSettings;

export const NewUserEmail = ({
  userName,
  profileLink,
  primaryColor,
  language = "en",
}: NewUserEmailProps) => {
  const { heading, paragraphs, buttonText } = getNewUserEmailTranslations(language, userName);

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: profileLink,
    primaryColor,
  });
};

export default NewUserEmail;
