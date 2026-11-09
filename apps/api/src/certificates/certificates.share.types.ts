import type { CertificateRepository } from "./certificate.repository";
import type { SupportedLanguages } from "@repo/shared";
import type { GlobalSettingsJSONContentSchema } from "src/settings/schemas/settings.schema";

export type ShareCertificateRecord = NonNullable<
  Awaited<ReturnType<CertificateRepository["findPublicShareCertificateById"]>>
>;

export type ShareRenderContext = {
  certificate: ShareCertificateRecord;
  shareUrl: string;
  shareImageUrl: string;
  settings: GlobalSettingsJSONContentSchema;
  formattedDate: string;
  language: SupportedLanguages;
};

export type ShareImageRenderContext = ShareRenderContext & {
  platformLogoDataUri: string | null;
  certificateSignatureUrl: string | null;
  certificateBackgroundUrl: string | null;
};

/** Unescaped values for the public share page; the page builder escapes everything it renders. */
export type CertificateSharePageContent = {
  language: SupportedLanguages;
  pageTitle: string;
  pageDescription: string;
  shareUrl: string;
  shareImageUrl: string;
  imageWidth: number;
  imageHeight: number;
  homeUrl: string;
  openLabel: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null | undefined;
  contrastColor: string | null | undefined;
  embeddedImage: string;
};
