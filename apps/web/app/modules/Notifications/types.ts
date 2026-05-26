import type { SupportedLanguages } from "@repo/shared";

export type TranslationDraft = {
  title: string;
  content: string;
};

export type TranslationFormValues = {
  groupId: string | null;
  translations: Record<SupportedLanguages, TranslationDraft>;
};

export type CreateAnnouncementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
