import { getUserLongInactivityEmailTranslations } from "translations/userLongInactivity";

import { BaseEmailTemplate } from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserLongInactivityProps = {
  courseName: string;
  courseLink: string;
} & DefaultEmailSettings;

export const UserLongInactivityEmail = ({
  courseName,
  courseLink,
  primaryColor,
  companyName,
  language = "en",
}: UserLongInactivityProps) => {
  const { heading, paragraphs, buttonText } = getUserLongInactivityEmailTranslations(
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

export default UserLongInactivityEmail;
