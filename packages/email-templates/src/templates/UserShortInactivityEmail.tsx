import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserShortInactivityProps = {
  courseName: string;
  courseLink: string;
} & DefaultEmailSettings;

export const UserShortInactivityEmail = ({
  courseName,
  courseLink,
  primaryColor = "#4796FD",
}: UserShortInactivityProps) => {
  return BaseEmailTemplate({
    heading: "Reminder",
    paragraphs: [
      "Resume learning 🔔",
      `14 days since last activity in ${courseName}. Continue to keep your progress on track.`,
    ],
    buttonText: "CONTINUE COURSE",
    buttonLink: courseLink,
    primaryColor,
  });
};

export default UserShortInactivityEmail;
