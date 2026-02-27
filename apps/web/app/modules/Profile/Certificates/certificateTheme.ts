export interface CertificateColorTheme {
  titleColor: string;
  certifyTextColor: string;
  nameColor: string;
  courseNameColor: string;
  bodyTextColor: string;
  labelTextColor: string;
  lineColor: string;
  logoColor: string;
}

export const defaultCertificateColorTheme: CertificateColorTheme = {
  titleColor: "#1f2937",
  certifyTextColor: "#374151",
  nameColor: "#1f2937",
  courseNameColor: "#1f2937",
  bodyTextColor: "#4b5563",
  labelTextColor: "#1f2937",
  lineColor: "#9ca3af",
  logoColor: "#1f2937",
};

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
