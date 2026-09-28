import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { LESSON_TYPES, PERMISSIONS } from "@repo/shared";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { MasterCourseSnapshotService } from "src/courses/master-course-snapshot.service";
import { MasterCourseRepository } from "src/courses/master-course.repository";
import {
  getAllImageVariantKeys,
  isImageVariantReference,
} from "src/file/image-variants/image-variant.utils";
import { S3Service } from "src/s3/s3.service";

import { NATIVE_ARCHIVE_OMITTED_ROW_FIELDS } from "../native-archive.constants";
import { NativeArchiveSnapshotRepository } from "../repositories/native-archive-snapshot.repository";

import type { NativeArchiveLearningPathSnapshot } from "../native-archive-learning-path.types";
import type {
  NativeArchiveFile,
  NativeArchiveLiveTrainingExportRows,
  NativeArchiveLiveTrainingLessonSnapshot,
  NativeArchiveRecord,
  NativeArchiveSnapshotResult,
  NativeArchiveTrainingMaterialSnapshot,
} from "../native-archive.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SourceSnapshot } from "src/courses/types/master-course.types";

function cleanRow(row: unknown): NativeArchiveRecord {
  if (!row || typeof row !== "object" || Array.isArray(row)) return {};
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !NATIVE_ARCHIVE_OMITTED_ROW_FIELDS.has(key))
      .map(([key, value]) => [key, cleanValue(value)]),
  );
}

function cleanValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === "object") return cleanRow(value);
  return value;
}

function cleanSnapshot(snapshot: SourceSnapshot): NativeArchiveRecord {
  return Object.fromEntries(
    Object.entries(snapshot).map(([key, value]) => [key, cleanValue(value)]),
  );
}

@Injectable()
export class NativeArchiveSnapshotService {
  constructor(
    private readonly nativeArchiveSnapshotRepository: NativeArchiveSnapshotRepository,
    private readonly masterCourseRepository: MasterCourseRepository,
    private readonly masterCourseSnapshotService: MasterCourseSnapshotService,
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
  ) {}

  async buildCourseExportSnapshot(
    courseId: UUIDType,
    actor: CurrentUserType,
  ): Promise<NativeArchiveSnapshotResult> {
    const snapshot = await this.loadCourseSnapshotForExport(courseId, actor, true);
    const document = await this.serializeCourseSnapshotWithLiveTraining(snapshot);

    return {
      courses: { [courseId]: document },
      files: await this.collectReferencedAssets(actor.tenantId, [snapshot], null, null, [document]),
    };
  }

  async buildLearningPathExportSnapshot(
    pathId: UUIDType,
    actor: CurrentUserType,
  ): Promise<NativeArchiveSnapshotResult> {
    const learningPath = await this.nativeArchiveSnapshotRepository.findLearningPathById(pathId);

    if (!learningPath) throw new NotFoundException("nativeArchive.error.pathNotFound");

    const canManage = await this.canActorManageContent(
      actor,
      learningPath.authorId,
      PERMISSIONS.LEARNING_PATH_UPDATE,
      PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
    );

    if (!canManage) throw new ForbiddenException("nativeArchive.error.accessDenied");

    const links = await this.nativeArchiveSnapshotRepository.findLearningPathCourses(pathId);
    const snapshots = await Promise.all(
      links.map((link) => this.loadCourseSnapshotForExport(link.courseId, actor, false)),
    );

    const courseDocuments = await Promise.all(
      snapshots.map((snapshot) => this.serializeCourseSnapshotWithLiveTraining(snapshot)),
    );

    const { authorId: _authorId, ...learningPathFields } = learningPath;

    const learningPathSnapshot: NativeArchiveLearningPathSnapshot = {
      ...learningPathFields,
      courseLinks: links,
    };

    return {
      courses: Object.fromEntries(
        snapshots.map((snapshot, index) => [snapshot.course.id, courseDocuments[index]]),
      ),
      learningPath: learningPathSnapshot,
      files: await this.collectReferencedAssets(
        actor.tenantId,
        snapshots,
        learningPath.thumbnailReference,
        learningPath.settings.certificateSignature,
        courseDocuments,
      ),
    };
  }

  private async serializeCourseSnapshotWithLiveTraining(
    snapshot: SourceSnapshot,
  ): Promise<NativeArchiveRecord> {
    const courseDocument = cleanSnapshot(snapshot);
    const liveLessonIds = snapshot.lessons
      .filter((lesson) => lesson.type === LESSON_TYPES.LIVE_TRAINING)
      .map((lesson) => lesson.id);

    if (!liveLessonIds.length) return courseDocument;

    const rows = await this.loadLiveTrainingExportRows(liveLessonIds);

    return {
      ...courseDocument,
      liveTrainingLessons: this.serializeLiveTrainingLessons(rows),
    };
  }

  private async loadLiveTrainingExportRows(
    lessonIds: UUIDType[],
  ): Promise<NativeArchiveLiveTrainingExportRows> {
    const liveLessons = await this.nativeArchiveSnapshotRepository.findLiveLessons(lessonIds);
    const trainingIds = [...new Set(liveLessons.map((lesson) => lesson.liveTrainingId))];
    const trainings = await this.nativeArchiveSnapshotRepository.findLiveTrainings(trainingIds);
    const [events, materials] = await Promise.all([
      this.nativeArchiveSnapshotRepository.findCalendarEvents(
        trainings.map((training) => training.calendarEventId),
      ),
      this.nativeArchiveSnapshotRepository.findTrainingMaterials(trainingIds),
    ]);

    return { liveLessons, trainings, events, materials };
  }

  private serializeLiveTrainingLessons(
    rows: NativeArchiveLiveTrainingExportRows,
  ): NativeArchiveLiveTrainingLessonSnapshot[] {
    const trainingsById = new Map(rows.trainings.map((training) => [training.id, training]));
    const eventsById = new Map(rows.events.map((event) => [event.id, event]));
    const materialsByTrainingId = new Map<UUIDType, NativeArchiveTrainingMaterialSnapshot[]>();

    for (const material of rows.materials) {
      const materials = materialsByTrainingId.get(material.trainingId) ?? [];

      materials.push({
        relationshipType: material.relationshipType,
        resource: cleanRow(material.resource),
      });

      materialsByTrainingId.set(material.trainingId, materials);
    }

    return rows.liveLessons.map((lesson) => {
      const training = trainingsById.get(lesson.liveTrainingId);
      const event = training && eventsById.get(training.calendarEventId);

      if (!training || !event)
        throw new NotFoundException("nativeArchive.error.liveTrainingIncomplete");

      return {
        lessonId: lesson.lessonId,
        language: lesson.language,
        training: cleanRow(training),
        event: cleanRow(event),
        materials: materialsByTrainingId.get(training.id) ?? [],
      };
    });
  }

  private async loadCourseSnapshotForExport(
    courseId: UUIDType,
    actor: CurrentUserType,
    assertManage: boolean,
  ): Promise<SourceSnapshot> {
    const course = await this.masterCourseRepository.getCourseById(courseId);

    if (!course) throw new NotFoundException("nativeArchive.error.courseNotFound");

    if (
      assertManage &&
      !(await this.canActorManageContent(
        actor,
        course.authorId,
        PERMISSIONS.COURSE_UPDATE,
        PERMISSIONS.COURSE_UPDATE_OWN,
      ))
    ) {
      throw new ForbiddenException("nativeArchive.error.accessDenied");
    }

    const snapshot = await this.masterCourseSnapshotService.buildSourceSnapshot(course);

    if (!snapshot) throw new NotFoundException("nativeArchive.error.categoryNotFound");

    if (!snapshot.course.authorMetadata) {
      const author = await this.nativeArchiveSnapshotRepository.findCourseAuthorMetadata(
        course.authorId,
      );

      if (author) snapshot.course.authorMetadata = { authorId: course.authorId, ...author };
    }

    return snapshot;
  }

  private async canActorManageContent(
    actor: CurrentUserType,
    authorId: UUIDType,
    globalPermission: typeof PERMISSIONS.COURSE_UPDATE | typeof PERMISSIONS.LEARNING_PATH_UPDATE,
    ownPermission:
      | typeof PERMISSIONS.COURSE_UPDATE_OWN
      | typeof PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
  ): Promise<boolean> {
    const permissions = await this.nativeArchiveSnapshotRepository.findUserManagePermissions(
      actor.userId,
      globalPermission,
      ownPermission,
    );

    return Boolean(permissions?.global || (permissions?.own && authorId === actor.userId));
  }

  private async collectReferencedAssets(
    tenantId: UUIDType,
    snapshots: SourceSnapshot[],
    pathThumbnail: string | null = null,
    pathCertificateSignature: string | null = null,
    documents: Record<string, unknown>[] = [],
  ): Promise<NativeArchiveFile[]> {
    const allReferences = [
      pathThumbnail,
      pathCertificateSignature,
      ...this.collectLiveTrainingMaterialReferences(documents),
      ...(await this.collectSnapshotAssetReferences(snapshots)),
    ].filter(
      (reference): reference is string =>
        typeof reference === "string" && reference.length > 0 && !/^https?:\/\//i.test(reference),
    );

    const variantBases = new Set(allReferences.filter(isImageVariantReference));
    const directReferences = allReferences.filter(
      (reference) => !isImageVariantReference(reference),
    );
    const variantReferences = await this.resolveImageVariantReferences(variantBases);

    return [...new Set([...directReferences, ...variantReferences])].map((sourceReference) =>
      this.toArchiveFile(sourceReference, tenantId),
    );
  }

  private collectLiveTrainingMaterialReferences(
    documents: Record<string, unknown>[],
  ): (string | null | undefined)[] {
    const references: (string | null | undefined)[] = [];
    for (const document of documents) {
      const lessons = document.liveTrainingLessons;
      if (!Array.isArray(lessons)) continue;

      for (const lesson of lessons) {
        if (!lesson || typeof lesson !== "object" || !Array.isArray(lesson.materials)) continue;
        for (const material of lesson.materials) references.push(material.resource?.reference);
      }
    }
    return references;
  }

  private async collectSnapshotAssetReferences(
    snapshots: SourceSnapshot[],
  ): Promise<(string | null | undefined)[]> {
    const references: (string | null | undefined)[] = [];
    for (const snapshot of snapshots) {
      references.push(snapshot.course.thumbnailS3Key);
      references.push(snapshot.course.authorMetadata?.profilePictureReference);

      references.push(snapshot.course.settings.certificateSignature);

      for (const lesson of snapshot.lessons) references.push(lesson.fileS3Key);
      for (const question of snapshot.questions) references.push(question.photoS3Key);
      for (const mentor of snapshot.aiMentors) references.push(mentor.avatarReference);
      for (const resource of snapshot.lessonContentResources) references.push(resource.reference);
      for (const pair of [
        ...snapshot.lessonResources,
        ...snapshot.questionResources,
        ...snapshot.courseResources,
      ]) {
        references.push(pair.resource.reference);
      }

      for (const scormPackage of snapshot.scormPackages) {
        references.push(scormPackage.originalFileReference);

        const keys = await this.s3Service.listFileKeysByPrefix(
          scormPackage.extractedFilesReference,
        );

        references.push(...keys);
      }
    }
    return references;
  }

  private async resolveImageVariantReferences(variantBases: Set<string>): Promise<string[]> {
    const references: string[] = [];
    for (const base of variantBases) {
      const variantKeys = getAllImageVariantKeys(base);
      const available = await Promise.all(
        variantKeys.map(async (key) => ((await this.s3Service.getFileExists(key)) ? key : null)),
      );
      const found = available.filter((key): key is string => Boolean(key));

      if (!found.length) throw new NotFoundException("nativeArchive.error.missingAsset");
      references.push(...found);
    }
    return references;
  }

  private toArchiveFile(sourceReference: string, tenantId: UUIDType): NativeArchiveFile {
    if (sourceReference.startsWith("bunny-")) {
      return {
        path: sourceReference,
        sourceReference,
        contentType: "video/mp4",
        open: async () => {
          const tenantHost = await this.masterCourseRepository.getTenantHost(tenantId);
          if (!tenantHost) throw new NotFoundException("masterCourse.error.sourceTenantMissing");

          const video = await this.bunnyStreamService.downloadMp4Fallback(
            sourceReference.slice("bunny-".length),
            720,
            tenantHost,
          );

          return video.stream;
        },
      };
    }

    return {
      path: sourceReference,
      sourceReference,
      contentType: "application/octet-stream",
      open: async () => (await this.s3Service.getFileStream(sourceReference)).stream,
    };
  }
}
