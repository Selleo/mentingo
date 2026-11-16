import AdmZip from "adm-zip";
import request from "supertest";

import {
  downloadNativeArchive,
  waitForNativeArchiveJob,
} from "src/native-archive/services/__tests__/native-archive-export.e2e-utils";

import type { INestApplication } from "@nestjs/common";

export async function exportCourseAsScormPackage(
  app: INestApplication,
  courseId: string,
  cookie: string,
) {
  const response = await request(app.getHttpServer())
    .post(`/api/course/${courseId}/scorm-export?language=en`)
    .set("Cookie", cookie)
    .expect(201);
  const { jobId } = response.body.data;
  const status = await waitForNativeArchiveJob(app, jobId, cookie);

  if (status.state !== "completed") {
    throw new Error(`SCORM export job ${jobId} ended as ${status.state}: ${status.failedReason}`);
  }

  const download = await downloadNativeArchive(app, jobId, cookie);

  return new AdmZip(download.body);
}
