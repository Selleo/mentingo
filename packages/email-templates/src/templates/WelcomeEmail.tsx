import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type WelcomeEmailProps = {
  coursesLink: string;
} & DefaultEmailSettings;

export const WelcomeEmail = ({ coursesLink, primaryColor = "#4796FD" }: WelcomeEmailProps) => {
  return BaseEmailTemplate({
    heading: "Welcome",
    paragraphs: [
      "Good to have you here 🙂",
      "Your account has been successfully created. Check your assigned courses.",
    ],
    buttonText: "VIEW COURSES",
    buttonLink: coursesLink,
    primaryColor,
  });
};

export default WelcomeEmail;
