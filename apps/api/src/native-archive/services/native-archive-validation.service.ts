import { BadRequestException, Injectable } from "@nestjs/common";
import { Value } from "@sinclair/typebox/value";

import {
  getAllImageVariantKeys,
  isImageVariantReference,
} from "src/file/image-variants/image-variant.utils";

import { NATIVE_ARCHIVE_KIND } from "../native-archive.constants";
import {
  nativeArchiveCourseLanguageSchema,
  nativeArchiveCourseSnapshotSchema,
} from "../schemas/native-archive-course-snapshot.schema";
import {
  nativeArchiveLearningPathLanguageSchema,
  nativeArchiveLearningPathSchema,
} from "../schemas/native-archive-learning-path.schema";
import { nativeArchiveScormPathSegmentsSchema } from "../schemas/native-archive-scorm-path.schema";

import type { NativeArchiveLearningPathImportSnapshot } from "../native-archive-learning-path.types";
import type {
  NativeArchiveAsset,
  NativeArchiveKind,
  NativeArchiveValidatedCourseSnapshot,
  ParsedNativeArchive,
} from "../native-archive.types";
import type { UUIDType } from "src/common";

@Injectable()
export class NativeArchiveValidationService {
  assertRequiredAssetsPresent(
    parsed: ParsedNativeArchive,
    snapshots: NativeArchiveValidatedCourseSnapshot[],
    learningPath?: NativeArchiveLearningPathImportSnapshot,
  ): void {
    const available = new Set(parsed.manifest.assets.map((asset) => asset.sourceReference));

    if (learningPath) {
      this.assertReferencePresent(learningPath.thumbnailReference, available);
      this.assertReferencePresent(learningPath.settings.certificateSignature, available);
    }

    for (const snapshot of snapshots) {
      this.assertCourseReferencesPresent(snapshot, available);
      for (const pkg of snapshot.scormPackages) {
        this.assertScormPackageAssetsPresent(pkg, parsed.manifest.assets, available);
      }
    }
  }

  private assertCourseReferencesPresent(
    snapshot: NativeArchiveValidatedCourseSnapshot,
    available: ReadonlySet<string>,
  ): void {
    const requireReference = (reference: string | null | undefined) =>
      this.assertReferencePresent(reference, available);

    requireReference(snapshot.course.thumbnailS3Key);
    requireReference(snapshot.course.authorMetadata?.profilePictureReference);
    requireReference(snapshot.course.settings.certificateSignature);
    snapshot.lessons.forEach((lesson) => requireReference(lesson.fileS3Key));
    snapshot.questions.forEach((question) => requireReference(question.photoS3Key));
    snapshot.aiMentors.forEach((mentor) => requireReference(mentor.avatarReference));
    snapshot.lessonContentResources.forEach((resource) => requireReference(resource.reference));
    [snapshot.lessonResources, snapshot.questionResources, snapshot.courseResources]
      .flat()
      .forEach(({ resource }) => requireReference(resource.reference));

    for (const record of snapshot.liveTrainingLessons ?? []) {
      record.materials.forEach(({ resource }) => requireReference(resource.reference));
    }
  }

  private assertScormPackageAssetsPresent(
    pkg: NativeArchiveValidatedCourseSnapshot["scormPackages"][number],
    assets: NativeArchiveAsset[],
    available: ReadonlySet<string>,
  ): void {
    this.assertReferencePresent(pkg.originalFileReference, available);

    const extractedFilesReference = pkg.extractedFilesReference.replace(/\/+$/, "");
    const scormAssets = assets.filter((asset) =>
      asset.sourceReference.startsWith(`${extractedFilesReference}/`),
    );

    if (!scormAssets.length) throw new BadRequestException("nativeArchive.error.missingAsset");

    for (const asset of scormAssets) {
      const relativePath = asset.sourceReference.slice(extractedFilesReference.length + 1);
      if (!Value.Check(nativeArchiveScormPathSegmentsSchema, relativePath.split("/"))) {
        throw new BadRequestException("nativeArchive.error.invalidAssetReference");
      }
    }
  }

  private assertReferencePresent(
    reference: string | null | undefined,
    available: ReadonlySet<string>,
  ): void {
    if (!reference || /^https?:\/\//i.test(reference)) return;

    const expected = isImageVariantReference(reference)
      ? getAllImageVariantKeys(reference)
      : [reference];
    if (!expected.some((key) => available.has(key))) {
      throw new BadRequestException("nativeArchive.error.missingAsset");
    }
  }

  validateCourseSnapshot(value: Record<string, unknown>): NativeArchiveValidatedCourseSnapshot {
    if (!Value.Check(nativeArchiveCourseLanguageSchema, value)) {
      throw new BadRequestException("nativeArchive.error.unsupportedLanguage");
    }

    if (!Value.Check(nativeArchiveCourseSnapshotSchema, value)) {
      throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");
    }

    const snapshot = value as unknown as NativeArchiveValidatedCourseSnapshot;
    const chapterIds = new Set(snapshot.chapters.map((chapter) => chapter.id));
    if (snapshot.lessons.some((lesson) => !chapterIds.has(lesson.chapterId))) {
      throw new BadRequestException("nativeArchive.error.invalidCourseSnapshot");
    }

    return snapshot;
  }

  validateLearningPathSnapshot(
    path: Record<string, unknown> | undefined,
    kind: NativeArchiveKind,
    rootId: UUIDType,
    courseIds: UUIDType[],
  ): NativeArchiveLearningPathImportSnapshot | undefined {
    if (kind === NATIVE_ARCHIVE_KIND.COURSE) return;

    if (!path) throw new BadRequestException("nativeArchive.error.invalidLearningPath");

    if (!Value.Check(nativeArchiveLearningPathLanguageSchema, path)) {
      throw new BadRequestException("nativeArchive.error.unsupportedLanguage");
    }

    if (!Value.Check(nativeArchiveLearningPathSchema, path) || path.id !== rootId) {
      throw new BadRequestException("nativeArchive.error.invalidLearningPath");
    }

    const links = path.courseLinks;

    if (
      links.length !== courseIds.length ||
      links.some((link) => !courseIds.includes(link.courseId))
    ) {
      throw new BadRequestException("nativeArchive.error.invalidLearningPath");
    }

    if (
      new Set(links.map((link) => link.courseId)).size !== links.length ||
      new Set(links.map((link) => link.displayOrder)).size !== links.length
    ) {
      throw new BadRequestException("nativeArchive.error.invalidLearningPath");
    }

    return path;
  }
}
