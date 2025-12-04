import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { CertificatesService } from "src/certificates/certificates.service";
import { CourseService } from "src/courses/course.service";
import { UpdateHasCertificateEvent } from "src/courses/events/updateHasCertificate.event";

type EventType = UpdateHasCertificateEvent;

const CourseEvents = [UpdateHasCertificateEvent];

@EventsHandler(...CourseEvents)
export class CourseHandler implements IEventHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly certificateService: CertificatesService,
  ) {}

  async handle(event: EventType) {
    await this.handleUpdateHasCertificate(event);
  }

  async handleUpdateHasCertificate(event: UpdateHasCertificateEvent) {
    const { courseId } = event;

    const students = await this.courseService.getStudentsWithoutCertificate(courseId);

    await Promise.all(
      students.map((student) =>
        this.certificateService.createCertificate(student.studentId, courseId),
      ),
    );
  }
}
