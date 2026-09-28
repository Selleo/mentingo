import { BadRequestException } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import {
  NATIVE_ARCHIVE_COURSE_ARRAY_FIELDS,
  NATIVE_ARCHIVE_KIND,
} from "../../native-archive.constants";
import { NativeArchiveValidationService } from "../native-archive-validation.service";

const COURSE_ID = "f594d687-096b-4599-84bf-1f296afdb1e1";
const CHAPTER_ID = "97a85c72-b2af-44bb-ae1a-d770bc8cbec2";
const LESSON_ID = "1234be44-7402-469e-8743-2e00c03c76aa";
const PATH_ID = "b7e3f32d-c1ab-4cb9-95e1-79212698bf54";

function snapshot(chapters: unknown[] = [{ id: CHAPTER_ID }], lessons: unknown[] = []) {
  const value: Record<string, unknown> = {
    course: {
      id: COURSE_ID,
      title: { en: "Course" },
      description: { en: "Description" },
      authorMetadata: null,
      thumbnailS3Key: null,
      settings: {},
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
    },
    category: {
      id: COURSE_ID,
      title: { en: "Category" },
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
    },
    categoryBaseTitle: "Category",
    chapters,
    lessons,
    questionGroups: [],
    questions: [],
    aiMentors: [],
    lessonContentResources: [],
    lessonResources: [],
    questionResources: [],
    courseResources: [],
    scormPackages: [],
  };

  for (const field of NATIVE_ARCHIVE_COURSE_ARRAY_FIELDS) value[field] ??= [];
  return value;
}

describe("NativeArchiveValidationService", () => {
  const service = new NativeArchiveValidationService();

  it.each([
    "../outside.html",
    "content//index.html",
    "content/./index.html",
    "content/../index.html",
    "content\\index.html",
  ])("rejects unsafe SCORM relative paths: %s", (relativePath) => {
    const extractedFilesReference = "course/scorm/extracted";
    const assets = [
      { sourceReference: "course/scorm/package.zip" },
      { sourceReference: `${extractedFilesReference}/${relativePath}` },
    ];

    expect(() =>
      service.assertRequiredAssetsPresent({ manifest: { assets } } as never, [
        {
          ...snapshot(),
          scormPackages: [
            {
              originalFileReference: "course/scorm/package.zip",
              extractedFilesReference,
            },
          ],
        } as never,
      ]),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidAssetReference"));
  });

  it("accepts safe SCORM relative paths", () => {
    const extractedFilesReference = "course/scorm/extracted";
    const assets = [
      { sourceReference: "course/scorm/package.zip" },
      { sourceReference: `${extractedFilesReference}/content/variants/index.html` },
    ];

    expect(() =>
      service.assertRequiredAssetsPresent({ manifest: { assets } } as never, [
        {
          ...snapshot(),
          scormPackages: [
            {
              originalFileReference: "course/scorm/package.zip",
              extractedFilesReference,
            },
          ],
        } as never,
      ]),
    ).not.toThrow();
  });

  it("rejects malformed chapter entries as an invalid snapshot", () => {
    expect(() => service.validateCourseSnapshot(snapshot([null]))).toThrow(
      new BadRequestException("nativeArchive.error.invalidCourseSnapshot"),
    );
  });

  it("rejects malformed lesson entries as an invalid snapshot", () => {
    expect(() => service.validateCourseSnapshot(snapshot(undefined, [null]))).toThrow(
      new BadRequestException("nativeArchive.error.invalidCourseSnapshot"),
    );
  });

  it("rejects malformed rows in any course snapshot collection", () => {
    expect(() =>
      service.validateCourseSnapshot({ ...snapshot(), assessments: [{ id: "invalid" }] }),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidCourseSnapshot"));
  });

  it("rejects malformed embedded live training before asset staging", () => {
    expect(() =>
      service.validateCourseSnapshot({
        ...snapshot(),
        liveTrainingLessons: [{ lessonId: LESSON_ID, language: "xx" }],
      }),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidCourseSnapshot"));
  });

  it("rejects unsupported languages in localized course fields", () => {
    expect(() =>
      service.validateCourseSnapshot({
        ...snapshot(),
        course: { ...(snapshot().course as object), baseLanguage: "xx" },
      }),
    ).toThrow(new BadRequestException("nativeArchive.error.unsupportedLanguage"));
  });

  it("rejects lessons that reference a missing chapter", () => {
    expect(() =>
      service.validateCourseSnapshot(
        snapshot(undefined, [{ id: LESSON_ID, chapterId: COURSE_ID }]),
      ),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidCourseSnapshot"));
  });

  it("accepts valid chapter and lesson identifiers and links", () => {
    expect(() =>
      service.validateCourseSnapshot(
        snapshot(undefined, [{ id: LESSON_ID, chapterId: CHAPTER_ID }]),
      ),
    ).not.toThrow();
  });

  it("accepts open text settings keyed by question ID", () => {
    expect(() =>
      service.validateCourseSnapshot({
        ...snapshot(),
        assessmentQuestionOpenTextSettings: [
          { questionId: LESSON_ID, minimumCharacters: 10, maximumCharacters: null },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects open text settings without a valid question ID", () => {
    expect(() =>
      service.validateCourseSnapshot({
        ...snapshot(),
        assessmentQuestionOpenTextSettings: [{ minimumCharacters: 10 }],
      }),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidCourseSnapshot"));
  });

  it("returns a validated learning path with its complete localized data", () => {
    const path = {
      id: PATH_ID,
      title: { en: "Path", pl: "Ścieżka" },
      description: { en: "Description" },
      thumbnailReference: null,
      includesCertificate: false,
      settings: { certificateSignature: null, certificateFontColor: null },
      sequenceEnabled: false,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
      courseLinks: [{ courseId: COURSE_ID, displayOrder: 0 }],
    };

    expect(
      service.validateLearningPathSnapshot(path, NATIVE_ARCHIVE_KIND.LEARNING_PATH, PATH_ID, [
        COURSE_ID,
      ]),
    ).toBe(path);
  });

  it("rejects malformed learning path settings at the archive boundary", () => {
    const path = {
      id: PATH_ID,
      title: { en: "Path" },
      description: { en: "Description" },
      thumbnailReference: null,
      includesCertificate: false,
      settings: { certificateSignature: 123, certificateFontColor: null },
      sequenceEnabled: false,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
      courseLinks: [{ courseId: COURSE_ID, displayOrder: 0 }],
    };

    expect(() =>
      service.validateLearningPathSnapshot(path, NATIVE_ARCHIVE_KIND.LEARNING_PATH, PATH_ID, [
        COURSE_ID,
      ]),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidLearningPath"));
  });

  it("rejects unsupported locales through the learning path schema", () => {
    const path = {
      id: PATH_ID,
      title: { en: "Path", xx: "Invalid locale" },
      description: { en: "Description" },
      thumbnailReference: null,
      includesCertificate: false,
      settings: { certificateSignature: null, certificateFontColor: null },
      sequenceEnabled: false,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
      courseLinks: [{ courseId: COURSE_ID, displayOrder: 0 }],
    };

    expect(() =>
      service.validateLearningPathSnapshot(path, NATIVE_ARCHIVE_KIND.LEARNING_PATH, PATH_ID, [
        COURSE_ID,
      ]),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidLearningPath"));
  });

  it("rejects learning path links that do not match the bundled courses", () => {
    const path = {
      id: PATH_ID,
      title: { en: "Path" },
      description: { en: "Description" },
      thumbnailReference: null,
      includesCertificate: false,
      settings: { certificateSignature: null, certificateFontColor: null },
      sequenceEnabled: false,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
      courseLinks: [{ courseId: PATH_ID, displayOrder: 0 }],
    };

    expect(() =>
      service.validateLearningPathSnapshot(path, NATIVE_ARCHIVE_KIND.LEARNING_PATH, PATH_ID, [
        COURSE_ID,
      ]),
    ).toThrow(new BadRequestException("nativeArchive.error.invalidLearningPath"));
  });
});
