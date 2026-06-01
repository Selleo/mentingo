import { getAnnouncementEmailTranslations } from "translations/announcementEmail";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type AnnouncementEmailProps = {
  title: string;
  content: string;
  buttonLink: string;
} & DefaultEmailSettings;

export const AnnouncementEmail = ({
  title,
  content,
  buttonLink,
  primaryColor,
  companyName,
  language = "en",
}: AnnouncementEmailProps) => {
  const { heading, paragraphs, buttonText } = getAnnouncementEmailTranslations(
    language,
    title,
    content,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink,
    primaryColor,
    companyName,
  });
};

export default AnnouncementEmail;
