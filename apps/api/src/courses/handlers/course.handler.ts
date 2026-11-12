import { CertificatesService } from "src/certificates/certificates.service";
import { CourseService } from "src/courses/course.service";
import { UpdateHasCertificateEvent } from "src/courses/events/updateHasCertificate.event";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type EventType = UpdateHasCertificateEvent;

const CourseEvents = [UpdateHasCertificateEvent];

@OutboxEventsHandler(...CourseEvents)
export class CourseHandler implements OutboxEventsHandlerOf<EventType> {
  constructor(
    private readonly courseService: CourseService,
    private readonly certificateService: CertificatesService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handleOutboxEvent(event: EventType) {
    await this.handleUpdateHasCertificate(event);
  }

  async handleUpdateHasCertificate(event: UpdateHasCertificateEvent) {
    const { courseData } = event;

    return this.tenantRunner.runWithTenant(courseData.tenantId, async () => {
      const { courseId } = courseData;
      const students = await this.courseService.getStudentsWithoutCertificate(courseId);

      await Promise.all(
        students.map(({ studentId }) =>
          this.certificateService.createCertificate(studentId, courseId),
        ),
      );
    });
  }
}
