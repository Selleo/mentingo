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
  certificateSignatureUrl: string | null;
  formattedDate: string;
  language: SupportedLanguages;
};
