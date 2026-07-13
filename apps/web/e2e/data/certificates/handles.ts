export const CERTIFICATES_HANDLES = {
  ROOT: "certificates-root",
  EMPTY_STATE: "certificates-empty-state",
  card: (certificateId: string) => `certificate-card-${certificateId}`,
} as const;

export const CERTIFICATE_PREVIEW_HANDLES = {
  MODAL: "certificate-preview-modal",
  CLOSE_BUTTON: "certificate-preview-close-button",
  DOWNLOAD_BUTTON: "certificate-preview-download-button",
  SHARE_LINKEDIN_BUTTON: "certificate-preview-share-linkedin-button",
  LANGUAGE_SELECT: "certificate-preview-language-select",
  COLOR_PICKER_TRIGGER: "certificate-preview-color-picker-trigger",
  COLOR_INPUT: "certificate-preview-color-input",
} as const;
