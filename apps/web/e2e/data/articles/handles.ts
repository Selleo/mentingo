export const ARTICLES_PAGE_HANDLES = {
  PAGE: "articles-page",
} as const;

export const ARTICLE_DETAILS_PAGE_HANDLES = {
  PAGE: "article-details-page",
  TITLE: "article-details-title",
  SUMMARY: "article-details-summary",
  EDIT_BUTTON: "article-details-edit-button",
  DELETE_BUTTON: "article-details-delete-button",
  DELETE_DIALOG: "article-details-delete-dialog",
  DELETE_CONFIRM_BUTTON: "article-details-delete-confirm-button",
  PREVIOUS_BUTTON: "article-details-previous-button",
  NEXT_BUTTON: "article-details-next-button",
} as const;

export const ARTICLE_FORM_PAGE_HANDLES = {
  PAGE: "article-form-page",
  TITLE_INPUT: "article-form-title-input",
  SUMMARY_INPUT: "article-form-summary-input",
  IS_PUBLIC_SWITCH: "article-form-is-public-switch",
  CONTENT_EDITOR_TAB: "article-form-content-editor-tab",
  CONTENT_PREVIEW_TAB: "article-form-content-preview-tab",
  SAVE_BUTTON: "article-form-save-button",
  CANCEL_BUTTON: "article-form-cancel-button",
} as const;

export const ARTICLE_SECTION_FORM_HANDLES = {
  TITLE_INPUT: "article-section-title-input",
  SAVE_BUTTON: "article-section-save-button",
  DELETE_BUTTON: "article-section-delete-button",
  DELETE_DIALOG: "article-section-delete-dialog",
  DELETE_CONFIRM_BUTTON: "article-section-delete-confirm-button",
} as const;

export const ARTICLES_TOC_HANDLES = {
  PANEL: "articles-toc-panel",
  CREATE_SECTION_ACTION: "articles-toc-create-section-action",
  CREATE_ARTICLE_ACTION: "articles-toc-create-article-action",
  SECTION_PREFIX: "articles-toc-section-",
  section: (sectionId: string) => `articles-toc-section-${sectionId}`,
  deleteSection: (sectionId: string) => `articles-toc-delete-section-${sectionId}`,
  ARTICLE_PREFIX: "articles-toc-article-",
  article: (articleId: string) => `articles-toc-article-${articleId}`,
} as const;
