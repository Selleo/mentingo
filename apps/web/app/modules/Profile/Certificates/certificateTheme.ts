import {
  defaultCertificateRenderTheme,
  type CertificateRenderTheme as CertificateColorTheme,
} from "@repo/shared";

export type { CertificateColorTheme };

export const defaultCertificateColorTheme = defaultCertificateRenderTheme;

export const applyUniformCertificateColor = (
  color: string,
  theme: CertificateColorTheme = defaultCertificateColorTheme,
): CertificateColorTheme => ({
  ...theme,
  titleColor: color,
  certifyTextColor: color,
  nameColor: color,
  courseNameColor: color,
  bodyTextColor: color,
  labelTextColor: color,
  lineColor: color,
  logoColor: color,
});

export const getCertificateColorTheme = (
  certificateFontColor?: string | null,
): CertificateColorTheme => {
  if (!certificateFontColor) return defaultCertificateColorTheme;
  return applyUniformCertificateColor(certificateFontColor);
};
