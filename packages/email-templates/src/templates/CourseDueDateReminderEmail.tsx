import { getCourseDueDateReminderEmailTranslations } from "translations/courseDueDateReminder";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type CourseDueDateReminderEmailProps = {
  courseName: string;
  courseLink: string;
  dueDate: string;
  daysBeforeDueDate: number;
} & DefaultEmailSettings;

export const CourseDueDateReminderEmail = ({
  courseName,
  courseLink,
  dueDate,
  daysBeforeDueDate,
  primaryColor,
  companyName,
  language = "en",
}: CourseDueDateReminderEmailProps) => {
  const { heading, paragraphs, buttonText } = getCourseDueDateReminderEmailTranslations(
    language,
    courseName,
    dueDate,
    daysBeforeDueDate,
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

export default CourseDueDateReminderEmail;
