import { BadRequestException } from "@nestjs/common";
import { LESSON_TYPES } from "@repo/shared";

import { NativeArchiveLiveTrainingService } from "../native-archive-live-training.service";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

const actor = {
  userId: "2cf24dba-5fb0-42bb-9af4-eec6990d01a2",
} as CurrentUserType;
const chapterId = "63ef450c-d95a-4c84-898c-0f8b0a227312" as UUIDType;
const targetChapterId = "10d9f3aa-9c4b-4cc2-afb7-4b9981f19a4e" as UUIDType;
const lessonId = "e34f6427-4be4-4b65-b7f7-cdd610d9bb78" as UUIDType;

function snapshot(title: unknown): SourceSnapshot {
  return {
    course: { id: "f594d687-096b-4599-84bf-1f296afdb1e1" },
    chapters: [{ id: chapterId }],
    lessons: [{ id: lessonId, chapterId, type: LESSON_TYPES.LIVE_TRAINING }],
    liveTrainingLessons: [
      {
        lessonId,
        language: "en",
        training: {
          id: "95287b72-b41d-4eb5-9f77-40c55fc6fc97",
          baseLanguage: "en",
          availableLocales: ["en", "pl"],
          deliveryType: "online",
          visibilityScope: "linked_courses",
          maxParticipants: 20,
          settings: { viewerPermissions: { microphoneEnabled: false, cameraEnabled: false } },
          metadata: {},
        },
        event: {
          title,
          description: { en: "Description", pl: "Opis" },
          startsAt: "2026-09-25T10:00:00.000Z",
          endsAt: "2026-09-25T11:00:00.000Z",
          allDay: false,
          timezone: "Europe/Warsaw",
          location: null,
          rrule: null,
          exdates: null,
          baseLanguage: "en",
          availableLocales: ["en", "pl"],
        },
        materials: [
          {
            relationshipType: "live_training_before",
            resource: {
              title: { en: "Handout", pl: "Materiały" },
              description: { en: "Notes" },
              reference: "handout.pdf",
              contentType: "application/pdf",
              metadata: {},
              visibility: "public",
            },
          },
        ],
      },
    ],
  } as unknown as SourceSnapshot;
}

function repository() {
  return {
    createCalendarEvent: jest.fn().mockResolvedValue("event-id"),
    createLiveTraining: jest.fn().mockResolvedValue("training-id"),
    createLiveTrainingLink: jest.fn().mockResolvedValue("link-id"),
    createResource: jest.fn().mockResolvedValue("resource-id"),
    createResourceEntity: jest.fn().mockResolvedValue(undefined),
    createLesson: jest.fn().mockResolvedValue("lesson-id"),
    createLiveLesson: jest.fn().mockResolvedValue(undefined),
    updateChapterLessonCount: jest.fn().mockResolvedValue(undefined),
  };
}

describe("NativeArchiveLiveTrainingService", () => {
  it("passes complete localized maps to the import repository", async () => {
    const archiveRepository = repository();
    const service = new NativeArchiveLiveTrainingService(archiveRepository as never);

    await service.restoreLiveTrainingLessons(
      snapshot({ en: "Workshop", pl: "Warsztat" }),
      new Map([[chapterId, targetChapterId]]),
      actor,
      "target-course-id",
    );

    expect(archiveRepository.createCalendarEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: { en: "Workshop", pl: "Warsztat" },
        description: { en: "Description", pl: "Opis" },
      }),
    );
    expect(archiveRepository.createResource).toHaveBeenCalledWith(
      expect.objectContaining({
        title: { en: "Handout", pl: "Materiały" },
        description: { en: "Notes" },
      }),
    );
    expect(archiveRepository.createLiveTrainingLink).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "target-course-id" }),
    );
    expect(archiveRepository.createLesson.mock.calls[0][0]).not.toHaveProperty("id");
  });

  it("cleans extra archive event fields before inserting with a generated uid", async () => {
    const archiveRepository = repository();
    const sourceSnapshot = snapshot({ en: "Workshop" }) as unknown as SourceSnapshot & {
      liveTrainingLessons: Array<{ event: Record<string, unknown> }>;
    };
    Object.assign(sourceSnapshot.liveTrainingLessons[0].event, {
      tenantId: "attacker-tenant",
      organizerUserId: "attacker-organizer",
      deletedAt: "2026-01-01T00:00:00.000Z",
    });
    const service = new NativeArchiveLiveTrainingService(archiveRepository as never);

    await service.restoreLiveTrainingLessons(
      sourceSnapshot,
      new Map([[chapterId, targetChapterId]]),
      actor,
      "target-course-id",
    );

    const [event] = archiveRepository.createCalendarEvent.mock.calls[0];
    expect(event).toEqual(
      expect.objectContaining({
        uid: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        title: { en: "Workshop" },
      }),
    );
    expect(event).not.toHaveProperty("tenantId");
    expect(event).not.toHaveProperty("organizerUserId");
    expect(event).not.toHaveProperty("deletedAt");
  });

  it("rejects invalid localized event titles before creating the event", async () => {
    const archiveRepository = repository();
    const service = new NativeArchiveLiveTrainingService(archiveRepository as never);

    await expect(
      service.restoreLiveTrainingLessons(
        snapshot({ xx: "Unsupported" }),
        new Map([[chapterId, targetChapterId]]),
        actor,
        "target-course-id",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(archiveRepository.createCalendarEvent).not.toHaveBeenCalled();
  });

  it("validates every live training record before creating any database rows", async () => {
    const archiveRepository = repository();
    const sourceSnapshot = snapshot({ en: "Workshop" }) as SourceSnapshot & {
      liveTrainingLessons: Record<string, unknown>[];
    };
    sourceSnapshot.liveTrainingLessons.push({
      ...sourceSnapshot.liveTrainingLessons[0],
      language: "xx",
    });
    const service = new NativeArchiveLiveTrainingService(archiveRepository as never);

    await expect(
      service.restoreLiveTrainingLessons(
        sourceSnapshot,
        new Map([[chapterId, targetChapterId]]),
        actor,
        "target-course-id",
      ),
    ).rejects.toThrow(BadRequestException);

    expect(archiveRepository.createCalendarEvent).not.toHaveBeenCalled();
    expect(archiveRepository.createLiveTraining).not.toHaveBeenCalled();
    expect(archiveRepository.createLiveTrainingLink).not.toHaveBeenCalled();
    expect(archiveRepository.createResource).not.toHaveBeenCalled();
    expect(archiveRepository.createResourceEntity).not.toHaveBeenCalled();
    expect(archiveRepository.createLesson).not.toHaveBeenCalled();
    expect(archiveRepository.createLiveLesson).not.toHaveBeenCalled();
  });
});
