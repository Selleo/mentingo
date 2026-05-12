import { eq } from "drizzle-orm";
import request from "supertest";

import { learningPathCourses } from "src/storage/schema";

import { DEFAULT_TEST_TENANT_HOST } from "../../../test/helpers/tenant-helpers";

import type { truncateTables } from "../../../test/helpers/test-helpers";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

export const SOURCE_HOST = DEFAULT_TEST_TENANT_HOST;
export const TARGET_HOST = "https://tenant-2.local";
export const PASSWORD = "Password123@";

export const TABLES_TO_TRUNCATE: Parameters<typeof truncateTables>[1] = [
  "learning_path_entity_map",
  "learning_path_exports",
  "learning_path_courses",
  "learning_paths",
  "master_course_entity_map",
  "master_course_exports",
  "student_learning_path_courses",
  "student_learning_paths",
  "student_courses",
  "courses",
  "categories",
  "users",
  "settings",
];

export const withTenantHost = (req: request.Test, host: string) =>
  req.set("Referer", host.endsWith("/") ? host : `${host}/`);

export const ensureCookieArray = (cookies: string | string[]) => {
  const normalizedCookies = (Array.isArray(cookies) ? cookies : [cookies]).map(
    (cookie) => cookie.split(";")[0],
  );
  const accessTokenCookie = normalizedCookies.find((cookie) => cookie.startsWith("access_token="));
  return accessTokenCookie ? [accessTokenCookie] : normalizedCookies;
};

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor<T>(
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 15000,
  intervalMs = 250,
): Promise<T> {
  const start = Date.now();
  let lastValue = await fetcher();

  while (!predicate(lastValue)) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }

    await sleep(intervalMs);
    lastValue = await fetcher();
  }

  return lastValue;
}

type LearningPathExportTestUtilsParams = {
  app: INestApplication;
  baseDb: DatabasePg;
  targetTenantId: string;
};

export const createLearningPathExportTestUtils = ({
  app,
  baseDb,
  targetTenantId,
}: LearningPathExportTestUtilsParams) => {
  const exportPath = async (
    learningPathId: string,
    sourceCookie: string[],
    targetTenantIds: string[],
  ) => {
    const exportResponse = await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/learning-path/master/${learningPathId}/export`)
        .set("Cookie", sourceCookie)
        .send({ targetTenantIds }),
      SOURCE_HOST,
    ).expect(201);

    const exportJobId = exportResponse.body.data.jobs[0].reason as string;

    await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/learning-path/master/export-jobs/${exportJobId}`)
            .set("Cookie", sourceCookie),
          SOURCE_HOST,
        ).expect(200);

        return response.body.data as {
          state: string;
          failedReason: string | null;
        };
      },
      (job) => {
        if (job.state === "failed") {
          throw new Error(`Export job failed: ${job.failedReason ?? "unknown reason"}`);
        }

        return job.state === "completed";
      },
    );

    return exportResponse.body.data as {
      jobs: Array<{ exportId: string; queued: boolean; reason?: string }>;
      sourceLearningPathId: string;
    };
  };

  const getExportedLearningPath = async (learningPathId: string, sourceCookie: string[]) => {
    const exportsList = await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/learning-path/master/${learningPathId}/exports`)
            .set("Cookie", sourceCookie),
          SOURCE_HOST,
        ).expect(200);

        return response.body.data as Array<{
          sourceLearningPathId: string;
          targetTenantId: string;
          targetLearningPathId: string | null;
          lastSyncedAt: string | null;
        }>;
      },
      (links) =>
        links.length === 1 &&
        links[0].targetTenantId === targetTenantId &&
        Boolean(links[0].targetLearningPathId) &&
        Boolean(links[0].lastSyncedAt),
    );

    return exportsList[0];
  };

  const getLearningPathCourseLinks = (learningPathId: string) => {
    return baseDb
      .select({
        courseId: learningPathCourses.courseId,
        displayOrder: learningPathCourses.displayOrder,
      })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, learningPathId))
      .orderBy(learningPathCourses.displayOrder);
  };

  return {
    exportPath,
    getExportedLearningPath,
    getLearningPathCourseLinks,
  };
};
