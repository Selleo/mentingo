import { getCertificateExpiredEmailTranslations } from "translations/certificateExpired";

import { BaseEmailTemplate } from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";
import type { CertificateArchiveReason } from "@repo/shared";

export type CertificateExpiredProps = {
  courseName: string;
  courseLink: string;
  reason: CertificateArchiveReason;
} & DefaultEmailSettings;

export const CertificateExpiredEmail = ({
  courseName,
  courseLink,
  reason,
  primaryColor,
  companyName,
  language = "en",
}: CertificateExpiredProps) => {
  const { heading, paragraphs, buttonText } = getCertificateExpiredEmailTranslations(
    language,
    courseName,
    reason,
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

export default CertificateExpiredEmail;
