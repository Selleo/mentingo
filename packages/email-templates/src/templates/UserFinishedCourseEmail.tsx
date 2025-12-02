import { getUserFinishedCourseEmailTranslations } from "translations/userFinishedCourse";

import { BaseEmailTemplate } from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserFinishedCourseProps = {
  courseName: string;
  buttonLink: string;
  hasCertificate: boolean;
} & DefaultEmailSettings;

export const UserFinishedCourseEmail = ({
  courseName,
  buttonLink,
  primaryColor,
  language = "en",
  hasCertificate,
}: UserFinishedCourseProps) => {
  const { heading, paragraphs, buttonText } = getUserFinishedCourseEmailTranslations(
    language,
    courseName,
    hasCertificate,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink,
    primaryColor,
  });
};

export default UserFinishedCourseEmail;
