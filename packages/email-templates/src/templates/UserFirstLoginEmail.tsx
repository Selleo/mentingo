import { getUserFirstLoginEmailTranslations } from "translations/userFirstLogin";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

type UserFirstLoginEmailProps = {
  name: string;
  coursesUrl: string;
} & DefaultEmailSettings;

export const UserFirstLoginEmail = ({
  name,
  coursesUrl,
  primaryColor,
  language = "en",
}: UserFirstLoginEmailProps) => {
  const { heading, paragraphs, buttonText } = getUserFirstLoginEmailTranslations(language, name);

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: coursesUrl,
    primaryColor,
  });
};

export default UserFirstLoginEmail;
