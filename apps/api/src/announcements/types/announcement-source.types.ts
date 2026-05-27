import type {
  AnnouncementEmailTemplate,
  AnnouncementSourceType,
  AnnouncementStatus,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";

export type AnnouncementTranslationInput = {
  language: SupportedLanguages;
  title: string;
  content: string;
};

export type ScheduleAnnouncementInput = {
  groupId: UUIDType | null;
  baseLanguage: SupportedLanguages;
  translations: AnnouncementTranslationInput[];
  authorId: UUIDType;
  scheduledAt: string | null;
  sendEmail: boolean;
  emailTemplate: AnnouncementEmailTemplate;
  sourceType: AnnouncementSourceType;
  sourceId: UUIDType | null;
  rejectPastSchedule: boolean;
};

export type CreateSystemAnnouncementInput = {
  translations: AnnouncementTranslationInput[];
  baseLanguage: SupportedLanguages;
  authorId: UUIDType;
  scheduledAt: string | null;
  sendEmail: boolean;
  emailTemplate: AnnouncementEmailTemplate;
  sourceType: AnnouncementSourceType;
  sourceId: UUIDType;
};

export type CreateAnnouncementRecordInput = {
  groupId: UUIDType | null;
  title: LocalizedText;
  content: LocalizedText;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
  authorId: UUIDType;
  status: AnnouncementStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  sendEmail: boolean;
  emailTemplate: AnnouncementEmailTemplate;
  sourceType: AnnouncementSourceType;
  sourceId: UUIDType | null;
};

export type AnnouncementSourceLookup = {
  sourceType: AnnouncementSourceType;
  sourceId: UUIDType;
};

export type TenantWithDueScheduledAnnouncements = {
  tenantId: UUIDType;
};
