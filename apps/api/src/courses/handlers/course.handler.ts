import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CertificatesService } from "src/certificates/certificates.service";
import { CourseService } from "src/courses/course.service";
import { UpdateHasCertificateEvent } from "src/courses/events/updateHasCertificate.event";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

type EventType = UpdateHasCertificateEvent;

const CourseEvents = [UpdateHasCertificateEvent];

@EventsHandler(...CourseEvents)
export class CourseHandler implements IEventHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly certificateService: CertificatesService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async handle(event: EventType) {
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
