export const TOAST_HANDLES = {
  VIEWPORT: "toast-viewport",
  ROOT: "toast-root",
  TITLE: "toast-title",
  DESCRIPTION: "toast-description",
} as const;

/** ErrorPage renders its action button/link with this test id. */
export const errorPageActionTestId = (testId: string) => `${testId}-action`;

export const PLATFORM_LOGO_HANDLES = {
  CUSTOM: "platform-logo-custom",
  CUSTOM_SIGNET: "platform-logo-custom-signet",
  DEFAULT: "platform-logo-default",
  /** Set only once the simple logo has loaded, so it proves no custom signet is configured. */
  DEFAULT_SIGNET: "platform-logo-default-signet",
} as const;

export const PRICE_INPUT_HANDLES = {
  CURRENCY: "price-input-currency",
} as const;

export const DATE_PICKER_HANDLES = {
  /** `day` is `yyyy-MM-dd`. */
  day: (pickerTestId: string, day: string) => `${pickerTestId}-day-${day}`,
} as const;

export const RICH_TEXT_HANDLES = {
  ROOT: "rich-text-editor",
  CONTENT: "rich-text-editor-content",
  AUDIO_PLAY_BUTTON: "rich-text-audio-play-button",
  AUDIO_PLAYBACK_SPEED_BUTTON: "rich-text-audio-playback-speed-button",
  AUDIO_COVERAGE_MARKERS: "rich-text-audio-coverage-markers",
  ASSET_LIBRARY_BUTTON: "rich-text-editor-asset-library-button",
  TABLE_MENU_BUTTON: "rich-text-editor-table-menu-button",
  TABLE_INSERT_BUTTON: "rich-text-editor-table-insert-button",
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
