import type {
  CalendarEventStatus,
  LiveTrainingDeliveryType,
  LiveTrainingLinkEntityType,
  LiveTrainingMemberRole,
  LiveTrainingSettings,
  LiveTrainingStatus,
  LiveTrainingVisibilityScope,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";

export type CreateLiveTrainingRecordInput = {
  calendarEvent: {
    uid: string;
    status: CalendarEventStatus;
    baseLanguage: SupportedLanguages;
    availableLocales: SupportedLanguages[];
    title: LocalizedText | SQL;
    description: LocalizedText | SQL | null;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    timezone: string;
    location: string | null;
    organizerUserId: UUIDType;
  };
  liveTraining: {
    authorId: UUIDType;
    baseLanguage: SupportedLanguages;
    availableLocales: SupportedLanguages[];
    deliveryType: LiveTrainingDeliveryType;
    visibilityScope: LiveTrainingVisibilityScope;
    status: LiveTrainingStatus;
    maxParticipants: number;
    settings: LiveTrainingSettings;
  };
  trainers: Array<{
    userId: UUIDType;
    role: LiveTrainingMemberRole;
    displayOrder: number;
  }>;
};

export type UpdateLiveTrainingRecordInput = {
  liveTrainingId: UUIDType;
  calendarEventId: UUIDType;
  calendarEvent?: Partial<{
    title: LocalizedText | SQL;
    description: LocalizedText | SQL | null;
    availableLocales: SupportedLanguages[];
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    timezone: string;
    location: string | null;
    sequence: number;
  }>;
  liveTraining?: Partial<{
    deliveryType: LiveTrainingDeliveryType;
    visibilityScope: LiveTrainingVisibilityScope;
    availableLocales: SupportedLanguages[];
    status: LiveTrainingStatus;
    maxParticipants: number;
    settings: LiveTrainingSettings;
  }>;
  trainers?: Array<{
    userId: UUIDType;
    role: LiveTrainingMemberRole;
    displayOrder: number;
  }>;
  links?: Array<{
    entityType: LiveTrainingLinkEntityType;
    entityId: UUIDType;
  }>;
  beforeResourceIds?: UUIDType[];
  afterResourceIds?: UUIDType[];
};

export type LiveTrainingListConditions = SQL[];

export type LiveTrainingListAppliedFilters = {
  status?: LiveTrainingStatus;
  deliveryType?: LiveTrainingDeliveryType;
  start?: string;
  end?: string;
  courseId?: UUIDType;
  language: SupportedLanguages;
};

export type LiveTrainingVisibilityRow = {
  authorId: UUIDType;
  visibilityScope: LiveTrainingVisibilityScope;
};

export type LiveTrainingVisibilityTrainer = {
  id: UUIDType;
};

export type LiveTrainingVisibilityLinkedCourse = {
  id: UUIDType;
};

export type CalendarEventUpdateInput = NonNullable<UpdateLiveTrainingRecordInput["calendarEvent"]>;

export type LiveTrainingUpdateInput = NonNullable<UpdateLiveTrainingRecordInput["liveTraining"]>;

export type LiveTrainingTrainerInput = NonNullable<UpdateLiveTrainingRecordInput["trainers"]>;

export type LiveTrainingLinkInput = NonNullable<UpdateLiveTrainingRecordInput["links"]>;
