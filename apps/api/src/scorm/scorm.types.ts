import type {
  ScormCompletionStatus,
  SCORM_IMPORT_ACTION,
  ScormSuccessStatus,
  SupportedLanguages,
} from "@repo/shared";
import type AdmZip from "adm-zip";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CreateScormCourseBody } from "src/scorm/schemas/createScormCourse.schema";
import type { CreateScormLessonBody } from "src/scorm/schemas/createScormLesson.schema";
import type {
  ScormRuntimeCommitBody,
  ScormRuntimeFinishBody,
} from "src/scorm/schemas/scormRuntime.schema";

export type CreateScormCourseImportParams = {
  scormPackage: Express.Multer.File;
  metadata: CreateScormCourseBody;
  currentUser: CurrentUserType;
  isPlaywrightTest: boolean;
};

export type CreateScormLessonImportParams = {
  scormPackage: Express.Multer.File;
  metadata: CreateScormLessonBody;
  currentUser: CurrentUserType;
};

export type AttachScormLessonPackageParams = {
  lessonId: UUIDType;
  scormPackage: Express.Multer.File;
  metadata: Omit<CreateScormLessonBody, "chapterId">;
  currentUser: CurrentUserType;
};

export type ScormImportResult = {
  id: UUIDType;
  packageId: UUIDType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  scoCount: number;
};

export type QueuedScormPackageFile = {
  stagedFileReference: string;
  originalname: string;
  mimetype: string;
  size: number;
};

type ScormImportJobDataBase = {
  packageId: UUIDType;
  scormPackage: QueuedScormPackageFile;
  currentUser: CurrentUserType;
  result: ScormImportResult;
};

export type CreateScormCourseImportJobData = ScormImportJobDataBase & {
  action: typeof SCORM_IMPORT_ACTION.CREATE_COURSE;
  metadata: CreateScormCourseBody;
  isPlaywrightTest: boolean;
};

export type CreateScormLessonImportJobData = ScormImportJobDataBase & {
  action: typeof SCORM_IMPORT_ACTION.CREATE_LESSON;
  metadata: CreateScormLessonBody;
};

export type AttachScormLessonPackageJobData = ScormImportJobDataBase & {
  action: typeof SCORM_IMPORT_ACTION.ATTACH_LESSON_PACKAGE;
  lessonId: UUIDType;
  metadata: Omit<CreateScormLessonBody, "chapterId">;
};

export type ScormImportJobData =
  | CreateScormCourseImportJobData
  | CreateScormLessonImportJobData
  | AttachScormLessonPackageJobData;

export type ScormImportJobSuccess = {
  success: true;
  data: ScormImportResult;
};

export type ScormImportJobFailure = {
  success: false;
  statusCode: number;
  message: string;
  response?: unknown;
};

export type ScormImportJobResult = ScormImportJobSuccess | ScormImportJobFailure;

export type ScormResourceManifest = {
  identifier: string;
  type?: string;
  scormType?: string;
  href?: string;
  xmlBase?: string;
  files: string[];
  dependencies: string[];
};

export type ScormItemManifest = {
  identifier: string;
  identifierRef?: string;
  title: string;
  parameters?: string;
  isVisible: boolean;
  parentIdentifier?: string;
  children: ScormItemManifest[];
};

export type ScormScoManifest = {
  item: ScormItemManifest;
  resource: ScormResourceManifest;
  href: string;
  launchPath: string;
  files: string[];
  displayOrder: number;
};

export type ParsedScormManifest = {
  manifestPath: string;
  manifestIdentifier?: string;
  version?: string;
  defaultOrganizationIdentifier?: string;
  organizationIdentifier?: string;
  title: string;
  resources: ScormResourceManifest[];
  items: ScormItemManifest[];
  scos: ScormScoManifest[];
};

export type PreparedPackageArtifacts = {
  packageId: UUIDType;
  entries: AdmZip.IZipEntry[];
  manifest: ParsedScormManifest;
  originalFileReference: string;
  extractedFilesReference: string;
  manifestReference: string;
  originalFile: Express.Multer.File;
};

type PersistPackageParamsBase = {
  packageId: UUIDType;
  manifest: ParsedScormManifest;
  originalFileReference: string;
  extractedFilesReference: string;
  manifestEntryPoint: string;
  manifestReference: string;
  currentUser: CurrentUserType;
};

export type PersistCoursePackageParams = PersistPackageParamsBase & {
  courseId: UUIDType;
  metadata: CreateScormCourseBody;
};

export type PersistLessonPackageParams = PersistPackageParamsBase & {
  lessonId: UUIDType;
  language: SupportedLanguages;
};

export type ScormRuntimeLaunchParams = {
  lessonId: UUIDType;
  scoId?: UUIDType;
  language: SupportedLanguages;
  currentUser: CurrentUserType;
};

export type ScormRuntimeCommitParams = {
  body: ScormRuntimeCommitBody;
  currentUser: CurrentUserType;
  finish: false;
};

export type ScormRuntimeFinishParams = {
  body: ScormRuntimeFinishBody;
  currentUser: CurrentUserType;
  finish: true;
};

export type UpsertScormRuntimeState = {
  attemptId: string;
  rawCmiJson: Record<string, string>;
  completionStatus: ScormCompletionStatus;
  successStatus: ScormSuccessStatus;
  scoreRaw?: string | null;
  scoreMin?: string | null;
  scoreMax?: string | null;
  lessonLocation?: string | null;
  suspendData?: string | null;
  sessionTime?: string | null;
  totalTime?: string | null;
  entry?: string | null;
  exit?: string | null;
};
