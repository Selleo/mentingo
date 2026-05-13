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
  ASSET_LIBRARY_BUTTON: "rich-text-editor-asset-library-button",
  ASSET_LIBRARY_DIALOG: "rich-text-asset-library-dialog",
  ASSET_LIBRARY_SEARCH_INPUT: "rich-text-asset-library-search-input",
  ASSET_LIBRARY_UPLOAD_INPUT: "rich-text-asset-library-upload-input",
  ASSET_LIBRARY_UPLOAD_BUTTON: "rich-text-asset-library-upload-button",
  ASSET_LIBRARY_DELETE_CONFIRM_BUTTON: "rich-text-asset-library-delete-confirm-button",
  ASSET_LIBRARY_DELETE_CANCEL_BUTTON: "rich-text-asset-library-delete-cancel-button",
  ASSET_LIBRARY_BACK_BUTTON: "rich-text-asset-library-back-button",
  assetLibraryRow: (assetId: string) => `rich-text-asset-library-row-${assetId}`,
  assetLibraryInsertButton: (assetId: string) => `rich-text-asset-library-insert-button-${assetId}`,
  assetLibraryDeleteButton: (assetId: string) => `rich-text-asset-library-delete-button-${assetId}`,
  UPLOAD_QUEUE: "rich-text-upload-queue",
  uploadQueueItem: (fileName: string) => `rich-text-upload-queue-item-${fileName}`,
  UPLOAD_DISPLAY_MODE_DIALOG: "rich-text-upload-display-mode-dialog",
  uploadDisplayModeOption: (mode: "preview" | "download") =>
    `rich-text-upload-display-mode-option-${mode}`,
  UPLOAD_DISPLAY_MODE_CANCEL_BUTTON: "rich-text-upload-display-mode-cancel-button",
  UPLOAD_DISPLAY_MODE_CONFIRM_BUTTON: "rich-text-upload-display-mode-confirm-button",
} as const;
