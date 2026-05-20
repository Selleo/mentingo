import { getCertificateExpirationWarningEmailTranslations } from "translations/certificateExpirationWarning";

import { BaseEmailTemplate } from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type CertificateExpirationWarningProps = {
  courseName: string;
  courseLink: string;
  expiresAt: string;
} & DefaultEmailSettings;

export const CertificateExpirationWarningEmail = ({
  courseName,
  courseLink,
  expiresAt,
  primaryColor,
  companyName,
  language = "en",
}: CertificateExpirationWarningProps) => {
  const { heading, paragraphs, buttonText } = getCertificateExpirationWarningEmailTranslations(
    language,
    courseName,
    expiresAt,
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

export default CertificateExpirationWarningEmail;
