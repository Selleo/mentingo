import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { USER_ROLE } from "~/config/userRoles";

import { createPrVideoCourse } from "./pr-video-data";

import type { FixtureApiClient } from "./api-client";
import type { CategoryFactory, CategoryFactoryRecord } from "../factories/category.factory";
import type { CourseFactory, CourseFactoryRecord } from "../factories/course.factory";
import type { PageHandle } from "../fixtures/types";
import type { UserRole } from "~/config/userRoles";

beforeEach(() => vi.stubGlobal("File", File));
afterEach(() => vi.unstubAllGlobals());

const category: CategoryFactoryRecord = {
  id: "team-development",
  title: "Team development",
  availableLocales: ["en"],
  baseLanguage: "en",
  createdAt: null,
};
const course: CourseFactoryRecord = {
  id: "feedback-course",
  title: "Giving useful feedback",
  category: category.title,
  categoryId: category.id,
  chapters: [],
  courseChapterCount: 0,
  currency: "USD",
  description: "Practice a feedback conversation with your team.",
  status: "draft",
  originType: "regular",
  isContentReadonly: false,
  courseType: "default",
  priceInCents: 0,
  availableLocales: ["en"],
  baseLanguage: "en",
};

const setup = (existingCategory: CategoryFactoryRecord | null = null) => {
  const tasks: (() => Promise<void> | void)[] = [];
  let activeRole: UserRole = USER_ROLE.admin;
  const deletions: { entity: string; role: UserRole }[] = [];
  const categoryFactory = {
    findByTitle: vi.fn<CategoryFactory["findByTitle"]>().mockResolvedValue(existingCategory),
    create: vi.fn<CategoryFactory["create"]>().mockResolvedValue(category),
    delete: vi.fn<CategoryFactory["delete"]>().mockImplementation(async () => {
      deletions.push({ entity: "category", role: activeRole });
    }),
  };
  const courseFactory = {
    create: vi.fn<CourseFactory["create"]>().mockResolvedValue(course),
    delete: vi.fn<CourseFactory["delete"]>().mockImplementation(async () => {
      deletions.push({ entity: "course", role: activeRole });
    }),
  };
  const upload = vi.fn<FixtureApiClient["api"]["fileControllerUploadFile"]>().mockResolvedValue({
    data: { fileKey: "tenant-demo/courses/uploaded-cover.svg" },
    status: 201,
    statusText: "Created",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
  const withWorkerPage = vi
    .fn<Parameters<typeof createPrVideoCourse>[0]["withWorkerPage"]>()
    .mockImplementation(async (role, run) => {
      activeRole = role;
      // The helper's teardown only needs the session established by this fixture.
      await run({} as PageHandle);
    });
  const input: Parameters<typeof createPrVideoCourse>[0] = {
    apiClient: { api: { fileControllerUploadFile: upload } },
    factories: {
      createCategoryFactory: () => categoryFactory,
      createCourseFactory: () => courseFactory,
    },
    cleanup: { add: vi.fn((task: () => Promise<void> | void) => tasks.push(task)) },
    withWorkerPage,
    title: course.title,
    categoryTitle: category.title,
    courseOverrides: { language: "en", description: course.description, hasCertificate: true },
  };

  return {
    input,
    tasks,
    categoryFactory,
    courseFactory,
    upload,
    withWorkerPage,
    deletions,
    switchToStudent: () => {
      activeRole = USER_ROLE.student;
    },
    cleanup: async () => {
      for (const task of [...tasks].reverse()) await task();
    },
  };
};

describe("PR video course setup", () => {
  it("reuses an exact seeded category and never registers its deletion", async () => {
    const harness = setup(category);
    const result = await createPrVideoCourse(harness.input);

    expect(harness.categoryFactory.findByTitle).toHaveBeenCalledWith(category.title);
    expect(harness.categoryFactory.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      course,
      category,
      courseId: course.id,
      categoryId: category.id,
      reusedCategory: true,
    });
    expect(harness.tasks).toHaveLength(1);
    await harness.cleanup();
    expect(harness.categoryFactory.delete).not.toHaveBeenCalled();
    expect(harness.courseFactory.delete).toHaveBeenCalledWith(course.id);
  });

  it("uploads the committed SVG as a real File and passes the raw returned fileKey", async () => {
    const harness = setup();
    await createPrVideoCourse(harness.input);
    const uploadInput = harness.upload.mock.calls[0]?.[0];
    expect(uploadInput?.resource).toBe("course");
    expect(uploadInput?.file).toBeInstanceOf(File);
    const uploadedFile = uploadInput?.file;
    if (!uploadedFile) throw new Error("Expected a cover file");
    const committedCover = await readFile(
      resolve(dirname(fileURLToPath(import.meta.url)), "../data/self-onboarding/cover.svg"),
      "utf8",
    );
    expect(uploadedFile.name).toBe("cover.svg");
    expect(uploadedFile.type).toBe("image/svg+xml");
    expect(await uploadedFile.text()).toBe(committedCover);
    expect(harness.courseFactory.create).toHaveBeenCalledWith({
      ...harness.input.courseOverrides,
      title: course.title,
      categoryId: category.id,
      thumbnailS3Key: "tenant-demo/courses/uploaded-cover.svg",
    });
  });

  it("registers category cleanup before upload and preserves it if course creation fails", async () => {
    const harness = setup();
    harness.upload.mockImplementationOnce(async () => {
      expect(harness.tasks).toHaveLength(1);
      throw new Error("Upload failed");
    });
    await expect(createPrVideoCourse(harness.input)).rejects.toThrow("Upload failed");
    await harness.cleanup();
    expect(harness.categoryFactory.delete).toHaveBeenCalledWith(category.id);
    expect(harness.courseFactory.create).not.toHaveBeenCalled();
  });

  it("keeps owned category cleanup registered when course creation rejects", async () => {
    const harness = setup();
    harness.courseFactory.create.mockImplementationOnce(async () => {
      expect(harness.tasks).toHaveLength(1);
      throw new Error("Course creation failed");
    });
    await expect(createPrVideoCourse(harness.input)).rejects.toThrow("Course creation failed");
    await harness.cleanup();
    expect(harness.categoryFactory.delete).toHaveBeenCalledWith(category.id);
    expect(harness.courseFactory.delete).not.toHaveBeenCalled();
  });

  it("registers course cleanup immediately and deletes course before category with admin cookies", async () => {
    const harness = setup();
    await createPrVideoCourse(harness.input);
    expect(harness.tasks).toHaveLength(2);
    harness.switchToStudent();
    await harness.cleanup();
    expect(harness.deletions).toEqual([
      { entity: "course", role: USER_ROLE.admin },
      { entity: "category", role: USER_ROLE.admin },
    ]);
    expect(harness.withWorkerPage.mock.calls.map(([role]) => role)).toEqual([
      USER_ROLE.admin,
      USER_ROLE.admin,
    ]);
  });

  it("rejects blank upload keys instead of creating a course without a cover", async () => {
    const harness = setup(category);
    harness.upload.mockResolvedValueOnce({
      data: { fileKey: " " },
      status: 201,
      statusText: "Created",
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
    });
    await expect(createPrVideoCourse(harness.input)).rejects.toThrow("no fileKey");
    expect(harness.courseFactory.create).not.toHaveBeenCalled();
  });
});
