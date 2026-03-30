import { getUserShortInactivityEmailTranslations } from "translations/userShortInactivity";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserShortInactivityProps = {
  courseName: string;
  courseLink: string;
} & DefaultEmailSettings;

export const UserShortInactivityEmail = ({
  courseName,
  courseLink,
  primaryColor,
  companyName,
  language = "en",
}: UserShortInactivityProps) => {
  const { heading, paragraphs, buttonText } = getUserShortInactivityEmailTranslations(
    language,
    courseName,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: courseLink,
    primaryColor,
    companyName,
  });
};

export default UserShortInactivityEmail;
