import { CertificateArchivedEmailEvent } from "src/events/certificate/certificate-archived-email.event";
import { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import { LessonCompletedEvent } from "src/events/lesson/lesson-completed.event";
import { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";

import { CompetenciesCertificatesHandler } from "./competencies-certificates.handler";
import { CompetenciesLearningHandler } from "./competencies-learning.handler";

describe("Competency learning outbox reactions", () => {
  it.each([
    LessonCompletedEvent,
    LessonProgressChangedEvent,
    UserCourseFinishedEvent,
    LearningSourceWithdrawnEvent,
  ])("awaits %p enqueueing so an intake failure can retry through the outbox", async (Event) => {
    const outbox = new OutboxDirectHandlerService();
    const enqueueCourseLearningFactsForCurrentTenant = jest
      .fn()
      .mockRejectedValueOnce(new Error("Redis unavailable"));
    const handler = new CompetenciesLearningHandler(
      { enqueueCourseLearningFactsForCurrentTenant } as never,
      outbox,
    );
    handler.onModuleInit();
    const event = new Event({
      userId: "learner",
      courseId: "course",
      lessonId: "lesson",
      actor: { tenantId: "tenant" },
    } as never);
    const payload = JSON.parse(JSON.stringify(event));

    await expect(outbox.dispatchReactions(Event.name, payload, "event")).rejects.toThrow(
      "Redis unavailable",
    );
    await outbox.dispatchReactions(Event.name, payload, "event");

    expect(enqueueCourseLearningFactsForCurrentTenant).toHaveBeenLastCalledWith(
      "learner",
      "course",
      "tenant",
      "event",
    );
    expect(enqueueCourseLearningFactsForCurrentTenant).toHaveBeenCalledTimes(2);
  });
  it("awaits certificate synchronization for the recipient's tenant", async () => {
    const outbox = new OutboxDirectHandlerService();
    const enqueueSubjectLearningFacts = jest
      .fn()
      .mockRejectedValueOnce(new Error("Redis unavailable"));
    new CompetenciesCertificatesHandler(
      { enqueueSubjectLearningFacts } as never,
      outbox,
    ).onModuleInit();
    const event = new CertificateArchivedEmailEvent({
      certificates: [{ tenantId: "tenant", userId: "learner" }],
    } as never);
    await expect(
      outbox.dispatchReactions(
        CertificateArchivedEmailEvent.name,
        JSON.parse(JSON.stringify(event)),
        "event",
      ),
    ).rejects.toThrow("Redis unavailable");
    expect(enqueueSubjectLearningFacts).toHaveBeenCalledWith("tenant", "learner", "event");
  });
});
