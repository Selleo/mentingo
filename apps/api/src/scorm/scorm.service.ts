import { BadRequestException, Injectable } from "@nestjs/common";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CreateScormCourseBody } from "src/scorm/schemas/createScormCourse.schema";

type PrepareCoursePackageParams = {
  courseId: UUIDType;
  scormPackage: Express.Multer.File;
  thumbnail?: Express.Multer.File;
  metadata: CreateScormCourseBody;
  currentUser: CurrentUserType;
};

@Injectable()
export class ScormService {
  async prepareCoursePackage({
    courseId,
    scormPackage,
    thumbnail: _thumbnail,
    metadata: _metadata,
    currentUser: _currentUser,
  }: PrepareCoursePackageParams) {
    if (!courseId) {
      throw new BadRequestException("Course id is required");
    }

    if (!scormPackage?.buffer?.length) {
      throw new BadRequestException("SCORM package is required");
    }

    // TODO: unpack the SCORM archive, parse imsmanifest.xml, persist package/SCO rows,
    // and create the generated course curriculum once the import pipeline is implemented.
    return {
      fileName: scormPackage.originalname,
      fileSize: scormPackage.size,
      mimeType: scormPackage.mimetype,
    };
  }
}
