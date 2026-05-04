import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CreateScormCourseBody } from "src/scorm/schemas/createScormCourse.schema";

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
