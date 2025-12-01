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
  });
};

export default UserLongInactivityEmail;
