import { getFinishedCourseEmailTranslations } from "translations/finishedCourse";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type FinishedCourseEmailProps = {
  userName: string;
  courseName: string;
  progressLink: string;
} & DefaultEmailSettings;

export const FinishedCourseEmail = ({
  userName,
  courseName,
  progressLink,
  primaryColor,
  language = "en",
}: FinishedCourseEmailProps) => {
  const { heading, paragraphs, buttonText } = getFinishedCourseEmailTranslations(
    language,
    userName,
    courseName,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: progressLink,
    primaryColor,
  });
};

export default FinishedCourseEmail;
