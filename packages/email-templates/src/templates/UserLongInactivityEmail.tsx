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
}: UserLongInactivityProps) => {
  return BaseEmailTemplate({
    heading: "Time to resume your course",
    paragraphs: [
      "Continue learning 📚",
      `It’s been 30 days since your last activity in ${courseName}. Resuming now will help you finish on time.`,
    ],
    buttonText: "RESUME COURSE",
    buttonLink: courseLink,
    primaryColor,
  });
};

export default UserLongInactivityEmail;
