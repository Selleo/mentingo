import type { SupportedLanguages } from "@repo/shared";

export type TranslationDraft = {
  title: string;
  content: string;
};

export type TranslationFormValues = {
  groupId: string | null;
  scheduled: boolean;
  scheduledDate: string;
  scheduledTime: string;
  sendEmail: boolean;
  translations: Record<SupportedLanguages, TranslationDraft>;
};

export type CreateAnnouncementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
