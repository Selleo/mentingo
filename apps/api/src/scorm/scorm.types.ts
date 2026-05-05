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
};

export type ScormRuntimeLaunchParams = {
  lessonId: UUIDType;
  scoId?: UUIDType;
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
