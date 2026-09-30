import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  LESSON_TYPES,
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  LIVE_TRAINING_VISIBILITY_SCOPES,
  RESOURCE_VISIBILITY,
  SCORM_PACKAGE_ENTITY_TYPE,
  SCORM_PACKAGE_STATUS,
  SCORM_STANDARD,
} from "@repo/shared";
import AdmZip from "adm-zip";

import { S3Service } from "src/s3/s3.service";

import { NATIVE_ARCHIVE_KIND } from "../../native-archive.constants";
import { buildNativeArchive } from "../native-archive-zip.service";

import type { NativeArchiveBuildInput } from "../../native-archive.types";
import type { UUIDType } from "src/common";

export const NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS = {
  course: "f594d687-096b-4599-84bf-1f296afdb1e1",
  reusedCourse: "af0f340d-b421-4f7b-9ab9-6ac6872831e3",
  secondCourse: "292e75e2-0d8e-4510-91b8-a5418f986c3b",
  learningPath: "b7e3f32d-c1ab-4cb9-95e1-79212698bf54",
  reuseLearningPath: "5ff3a055-25fd-45d0-a6bb-1f37b613d23c",
  standaloneCourse: "0daa0e1f-fbe0-4d55-840c-9b1c6600e34f",
  invalidCourse: "4c78b61b-66a4-42c1-b4b8-502b20c941b9",
  jobImportCourse: "d9ec1362-2666-4ca0-8428-ddbd5f9e41df",
  contentCourse: "ea62f42c-f98b-4054-99ad-43b94f333b06",
  contentChapter: "483118cc-428c-4c50-a9e7-df2501b4c2c6",
  contentLesson: "9283029c-e51a-4df5-92eb-f4c69473b45c",
  liveTrainingCourse: "c4024fa6-6720-4b02-b819-16caab62e8ed",
  liveTrainingChapter: "03888646-5227-47e3-91e7-4bd87d617dc3",
  liveTrainingLesson: "2ef14a82-4884-4a9c-b968-60b831eaf685",
  liveTraining: "33481812-f1d6-498d-8d82-6866247f2358",
  liveTrainingResource: "1de662c3-fdca-4c87-9b78-3c90d9d688fa",
  scormCourse: "db083599-e04a-43ec-adc4-42ab5309ba74",
  scormChapter: "53908cf7-1327-4356-ad1a-dbc566c6e97d",
  scormLesson: "7f36206f-206f-4d41-8e55-c76047071d52",
  scormPackage: "a12f1c83-2652-4a3a-a951-e40c7e39d8d3",
  scormSco: "a5c7bf98-e5d4-4615-b66e-2950b2e3b23f",
} as const satisfies Record<string, UUIDType>;

export function createNativeArchiveCourseSnapshot(
  id: UUIDType,
  options: { withContent?: boolean; withLiveTraining?: boolean } = {},
) {
  const chapterId = options.withLiveTraining
    ? NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.liveTrainingChapter
    : NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.contentChapter;
  const lessonId = options.withLiveTraining
    ? NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.liveTrainingLesson
    : NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.contentLesson;
  const hasLesson = options.withContent || options.withLiveTraining;
  return {
    course: {
      id,
      originalId: null,
      title: { en: `Archive course ${id}` },
      description: { en: "A course imported from a native archive" },
      courseType: "default",
      settings: { certificateSignature: null },
      baseLanguage: "en",
      availableLocales: ["en"],
    },
    category: {
      id: "46a9f9d9-2142-48ad-9538-7d754591ef7a",
      title: { en: "Archive category" },
      baseLanguage: "en",
      availableLocales: ["en"],
    },
    categoryBaseTitle: "Archive category",
    chapters: hasLesson
      ? [
          {
            id: chapterId,
            title: { en: "Archive content chapter" },
            isFreemium: false,
            displayOrder: 0,
            lessonCount: 1,
          },
        ]
      : [],
    lessons: hasLesson
      ? [
          {
            id: lessonId,
            chapterId,
            type: options.withLiveTraining ? LESSON_TYPES.LIVE_TRAINING : "content",
            title: {
              en: options.withLiveTraining
                ? "Archive live training lesson"
                : "Archive content lesson",
            },
            description: {
              en: options.withLiveTraining
                ? "A live training lesson restored by the native archive importer"
                : "A regular lesson copied by the native archive importer",
            },
            displayOrder: 0,
            fileS3Key: null,
          },
        ]
      : [],
    questions: [],
    options: [],
    assessmentQuestionBlanks: [],
    assessmentQuestionBlankAnswerSets: [],
    assessmentQuestionDragAndDropOptions: [],
    assessmentQuestionScaleOptions: [],
    assessmentQuestionTrueFalseStatements: [],
    questionResources: [],
    assessmentQuestionOpenTextSettings: [],
    assessments: [],
    aiMentors: [],
    aiMentorConfigurations: [],
    aiMentorTeacherConfigurations: [],
    aiMentorRoleplayConfigurations: [],
    aiJudgeConfigurations: [],
    aiJudgeCriteria: [],
    aiJudgeScoreGuidance: [],
    aiJudgeBlockingErrors: [],
    aiMentorDocumentLinks: [],
    aiMentorDocuments: [],
    aiMentorDocChunks: [],
    scormPackages: [],
    scormScos: [],
    lessonContentResources: [],
    lessonResources: [],
    courseResources: [],
    liveTrainingLessons: options.withLiveTraining
      ? [
          {
            lessonId,
            language: "en",
            training: {
              id: NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.liveTraining,
              baseLanguage: "en",
              availableLocales: ["en"],
              deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
              visibilityScope: LIVE_TRAINING_VISIBILITY_SCOPES.LINKED_COURSES,
              maxParticipants: 12,
              settings: {
                viewerPermissions: { microphoneEnabled: false, cameraEnabled: false },
              },
              metadata: { importedFrom: "native-archive-e2e" },
            },
            event: {
              title: { en: "Archive live training event" },
              description: { en: "A restored live training event" },
              startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              allDay: false,
              timezone: "Europe/Warsaw",
              location: "Training room",
              rrule: null,
              exdates: null,
              baseLanguage: "en",
              availableLocales: ["en"],
            },
            materials: [
              {
                relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
                resource: {
                  id: NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.liveTrainingResource,
                  title: { en: "Pre-training handout" },
                  description: { en: "Read before the training" },
                  reference: "https://assets.example.test/pre-training-handout.pdf",
                  contentType: "application/pdf",
                  metadata: { filename: "pre-training-handout.pdf" },
                  visibility: RESOURCE_VISIBILITY.PUBLIC,
                },
              },
            ],
          },
        ]
      : [],
  };
}

export function createNativeArchiveLearningPathSnapshot(
  courseIds: UUIDType[],
  id: UUIDType = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS.learningPath,
) {
  return {
    id,
    originalId: null,
    title: { en: "Archive learning path" },
    description: { en: "A learning path imported from a native archive" },
    thumbnailReference: null,
    includesCertificate: false,
    settings: { certificateSignature: null, certificateFontColor: null },
    sequenceEnabled: false,
    baseLanguage: "en",
    availableLocales: ["en"],
    courseLinks: courseIds.map((courseId, displayOrder) => ({ courseId, displayOrder })),
  };
}

export function createNativeArchiveScormFixture() {
  const ids = NATIVE_ARCHIVE_IMPORT_FIXTURE_IDS;
  const extractedFilesReference = "source/course/scorm/extracted";
  const originalFileReference = "source/course/scorm/minimal-package.zip";
  const packageZip = new AdmZip();
  packageZip.addFile(
    "imsmanifest.xml",
    Buffer.from(
      '<manifest identifier="archive-scorm"><resources><resource identifier="RES-1" href="index.html" /></resources></manifest>',
    ),
  );
  packageZip.addFile("index.html", Buffer.from("<html><body>SCORM launch file</body></html>"));
  packageZip.addFile("scripts/runtime.js", Buffer.from("window.archiveScormReady = true;"));
  const originalPackageBytes = packageZip.toBuffer();
  const extractedFileBytes = Buffer.from("<html><body>Copied extracted SCO</body></html>");
  const nestedFileBytes = Buffer.from("window.archiveScormReady = true;");
  const snapshot = {
    ...createNativeArchiveCourseSnapshot(ids.scormCourse),
    chapters: [
      {
        id: ids.scormChapter,
        title: { en: "Archive SCORM chapter" },
        isFreemium: false,
        displayOrder: 0,
        lessonCount: 1,
      },
    ],
    lessons: [
      {
        id: ids.scormLesson,
        chapterId: ids.scormChapter,
        type: LESSON_TYPES.SCORM,
        title: { en: "Archive SCORM lesson" },
        description: { en: "A SCORM lesson imported from an archive" },
        displayOrder: 0,
        fileS3Key: null,
      },
    ],
    scormPackages: [
      {
        id: ids.scormPackage,
        entityType: SCORM_PACKAGE_ENTITY_TYPE.LESSON,
        entityId: ids.scormLesson,
        language: "en",
        standard: SCORM_STANDARD.SCORM_1_2,
        originalFileReference,
        extractedFilesReference,
        manifestEntryPoint: `${extractedFilesReference}/index.html`,
        manifestJson: { entryPoint: `${extractedFilesReference}/index.html` },
        status: SCORM_PACKAGE_STATUS.READY,
      },
    ],
    scormScos: [
      {
        id: ids.scormSco,
        packageId: ids.scormPackage,
        lessonId: ids.scormLesson,
        organizationIdentifier: "ORG-1",
        identifier: "ITEM-1",
        identifierRef: "RES-1",
        resourceIdentifier: "RES-1",
        resourceType: "webcontent",
        scormType: "sco",
        title: "Archive launch SCO",
        href: "index.html",
        launchPath: `${extractedFilesReference}/index.html`,
        parameters: null,
        displayOrder: 0,
        parentIdentifier: null,
        isVisible: true,
        itemMetadataJson: null,
        resourceMetadataJson: null,
      },
    ],
  };

  const file = (archivePath: string, sourceReference: string, bytes: Buffer) => ({
    path: archivePath,
    sourceReference,
    contentType: "application/octet-stream",
    open: async () => Readable.from([bytes]),
  });
  const files = [
    file("assets/scorm/original-package", originalFileReference, originalPackageBytes),
    file(
      "assets/scorm/extracted-index",
      `${extractedFilesReference}/index.html`,
      extractedFileBytes,
    ),
    file(
      "assets/scorm/extracted-script",
      `${extractedFilesReference}/scripts/runtime.js`,
      nestedFileBytes,
    ),
  ];

  return {
    input: {
      kind: NATIVE_ARCHIVE_KIND.COURSE,
      rootId: ids.scormCourse,
      courses: { [ids.scormCourse]: snapshot },
      files,
    },
    snapshot,
    sourceCourseId: ids.scormCourse,
    sourceLessonId: ids.scormLesson,
    sourcePackageId: ids.scormPackage,
    originalPackageBytes,
    extractedFileBytes,
    nestedFileBytes,
    files,
  };
}

export function createNativeArchiveImportInput(
  kind: NativeArchiveBuildInput["kind"],
  snapshots: ReturnType<typeof createNativeArchiveCourseSnapshot>[],
  learningPath?: ReturnType<typeof createNativeArchiveLearningPathSnapshot>,
): NativeArchiveBuildInput {
  return {
    kind,
    rootId: learningPath?.id ?? snapshots[0].course.id,
    courses: Object.fromEntries(snapshots.map((snapshot) => [snapshot.course.id, snapshot])),
    ...(learningPath ? { learningPath } : {}),
    files: [],
  };
}

export async function writeNativeArchiveZip(
  input: NativeArchiveBuildInput,
  directory: string,
): Promise<string> {
  const archive = await buildNativeArchive(input);
  const zipPath = path.join(directory, `${randomUUID()}.zip`);

  try {
    await pipeline(archive.stream, createWriteStream(zipPath));
    return zipPath;
  } finally {
    await archive.cleanup();
  }
}

export function createInMemoryNativeArchiveStorage() {
  const storedObjects = new Map<string, { bytes: Buffer; contentType: string }>();
  const uploadedKeys: string[] = [];
  const deletedKeys: string[] = [];
  const copiedKeys: Array<{ sourceKey: string; targetKey: string }> = [];
  const s3ServiceMock = {
    isConfigured: jest.fn(() => true),
    uploadStreamMultipart: jest.fn(async (stream: Readable, key: string, contentType: string) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      storedObjects.set(key, { bytes: Buffer.concat(chunks), contentType });
      uploadedKeys.push(key);
    }),
    uploadFile: jest.fn(async (buffer: Buffer, key: string, contentType: string) => {
      storedObjects.set(key, { bytes: buffer, contentType });
      uploadedKeys.push(key);
    }),
    getFileStream: jest.fn(async (key: string) => {
      const file = storedObjects.get(key);
      if (!file) throw new Error(`Missing in-memory archive object: ${key}`);

      return {
        stream: Readable.from([file.bytes]),
        contentType: file.contentType,
        contentLength: file.bytes.length,
      };
    }),
    deleteFile: jest.fn(async (key: string) => {
      deletedKeys.push(key);
      storedObjects.delete(key);
    }),
    listFileKeysByPrefix: jest.fn(async (prefix: string) =>
      [...storedObjects.keys()].filter((key) => key.startsWith(prefix)),
    ),
    copyFile: jest.fn(async (sourceKey: string, targetKey: string, contentType?: string) => {
      const source = storedObjects.get(sourceKey);
      if (!source) throw new Error(`Missing in-memory source object: ${sourceKey}`);
      storedObjects.set(targetKey, {
        bytes: Buffer.from(source.bytes),
        contentType: contentType ?? source.contentType,
      });
      copiedKeys.push({ sourceKey, targetKey });
    }),
  };

  return {
    provider: { provide: S3Service, useValue: s3ServiceMock },
    s3ServiceMock,
    uploadedKeys,
    deletedKeys,
    copiedKeys,
    has: (key: string) => storedObjects.has(key),
    getBytes: (key: string) => storedObjects.get(key)?.bytes,
    getContentType: (key: string) => storedObjects.get(key)?.contentType,
  };
}
