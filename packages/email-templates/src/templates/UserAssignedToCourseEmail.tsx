import { getUserAssignedToCourseEmailTranslations } from "translations/userAssignedToCourse";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserAssignedToCourseProps = {
  courseName: string;
  courseLink: string;
} & DefaultEmailSettings;

export const UserAssignedToCourse = ({
  courseLink,
  courseName,
  primaryColor,
  language = "en",
}: UserAssignedToCourseProps) => {
  const { heading, paragraphs, buttonText } = getUserAssignedToCourseEmailTranslations(
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

export default UserAssignedToCourse;
