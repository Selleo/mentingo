import { getMagicLinkEmailTranslations } from "translations/magicLink";
import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type MagicLinkEmailProps = {
  magicLink: string;
} & DefaultEmailSettings;

export const MagicLinkEmail = ({
  magicLink,
  primaryColor,
  language = "en",
}: MagicLinkEmailProps) => {
  const { heading, paragraphs, buttonText } = getMagicLinkEmailTranslations(language);

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: magicLink,
    primaryColor,
  });
};

export default MagicLinkEmail;
