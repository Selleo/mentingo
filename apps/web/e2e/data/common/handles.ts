export const TOAST_HANDLES = {
  VIEWPORT: "toast-viewport",
  ROOT: "toast-root",
  TITLE: "toast-title",
  DESCRIPTION: "toast-description",
} as const;

export const RICH_TEXT_HANDLES = {
  ROOT: "rich-text-editor",
  CONTENT: "rich-text-editor-content",
  UPLOAD_FILE_INPUT: "rich-text-editor-upload-file-input",
  UPLOAD_BUTTON: "rich-text-editor-upload-button",
  UPLOAD_QUEUE: "rich-text-upload-queue",
  uploadQueueItem: (fileName: string) => `rich-text-upload-queue-item-${fileName}`,
  UPLOAD_DISPLAY_MODE_DIALOG: "rich-text-upload-display-mode-dialog",
  uploadDisplayModeOption: (mode: "preview" | "download") =>
    `rich-text-upload-display-mode-option-${mode}`,
  UPLOAD_DISPLAY_MODE_CANCEL_BUTTON: "rich-text-upload-display-mode-cancel-button",
  UPLOAD_DISPLAY_MODE_CONFIRM_BUTTON: "rich-text-upload-display-mode-confirm-button",
} as const;
