import { getWelcomeEmailTranslations } from "translations/welcome";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type WelcomeEmailProps = {
  coursesLink: string;
} & DefaultEmailSettings;

export const WelcomeEmail = ({
  coursesLink,
  primaryColor = "#4796FD",
  language = "en",
}: WelcomeEmailProps) => {
  const { heading, paragraphs, buttonText } = getWelcomeEmailTranslations(language);

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: coursesLink,
    primaryColor,
  });
};

export default WelcomeEmail;
