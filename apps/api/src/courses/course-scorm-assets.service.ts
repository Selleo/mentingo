import { BadRequestException, Injectable } from "@nestjs/common";
import { importedScormPackagePath } from "@repo/scorm-export-generator";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";

import type {
  ScormExportAssetReference,
  ScormExportCourseSnapshot,
  ScormExportImportedScormLessonSnapshot,
  ScormExportLessonSnapshot,
  ScormExportPackageFile,
} from "@repo/scorm-export-generator";

export type CourseScormAssetCollectionResult = {
  snapshot: ScormExportCourseSnapshot;
  files: ScormExportPackageFile[];
};

type AssetResolution = {
  asset: ScormExportAssetReference;
  packagePath: string;
  file?: ScormExportPackageFile;
};

type CollectAssetsOptions = {
  tenantOrigin?: string | null;
};

@Injectable()
export class CourseScormAssetsService {
  constructor(
    private readonly fileService: FileService,
    private readonly bunnyStreamService: BunnyStreamService,
  ) {}

  async collectAssets(
    snapshot: ScormExportCourseSnapshot,
    options: CollectAssetsOptions = {},
  ): Promise<CourseScormAssetCollectionResult> {
    const assetResolutions = await this.resolveAssets(this.getSnapshotAssets(snapshot), options);
    const importedScormPackageFiles = await this.collectImportedScormPackageFiles(snapshot);
    const resolutionByAssetId = new Map(
      assetResolutions.map((resolution) => [resolution.asset.id, resolution]),
    );

    return {
      snapshot: this.rewriteSnapshotAssetReferences(snapshot, resolutionByAssetId),
      files: this.dedupeFiles([
        ...assetResolutions.flatMap((resolution) => resolution.file ?? []),
        ...importedScormPackageFiles,
      ]),
    };
  }

  private async resolveAssets(
    assets: ScormExportAssetReference[],
    options: CollectAssetsOptions,
  ): Promise<AssetResolution[]> {
    const groupedAssets = this.groupAssetsBySourceReference(assets);
    const groupedResolutions = await Promise.all(
      Array.from(groupedAssets.values()).map(async ([canonicalAsset, ...reusedAssets]) => {
        const canonicalResolution = await this.resolveAsset(canonicalAsset, options);
        const reusedResolutions = reusedAssets.map((asset) => ({
          asset,
          packagePath: canonicalResolution.packagePath,
        }));

        return [canonicalResolution, ...reusedResolutions];
      }),
    );

    return groupedResolutions.flat();
  }

  private async resolveAsset(
    asset: ScormExportAssetReference,
    options: CollectAssetsOptions,
  ): Promise<AssetResolution> {
    if (this.isBunnyReference(asset.sourceReference)) {
      return this.resolveBunnyVideoAsset(asset, options);
    }

    if (this.shouldPreserveReference(asset.sourceReference)) {
      return {
        asset,
        packagePath: asset.sourceReference,
      };
    }

    const buffer = await this.fileService.getRawFileBuffer(asset.sourceReference);

    if (!buffer) {
      throw new BadRequestException("adminCourseView.scormExport.error.missingAsset");
    }

    return {
      asset,
      packagePath: asset.packagePath,
      file: {
        path: asset.packagePath,
        buffer,
      },
    };
  }

  private async resolveBunnyVideoAsset(
    asset: ScormExportAssetReference,
    options: CollectAssetsOptions,
  ): Promise<AssetResolution> {
    const videoId = asset.sourceReference.replace("bunny-", "");

    try {
      const file = await this.bunnyStreamService.downloadMp4Fallback(
        videoId,
        720,
        options.tenantOrigin,
      );

      return {
        asset,
        packagePath: asset.packagePath,
        file: {
          path: asset.packagePath,
          stream: file.stream,
        },
      };
    } catch {
      throw new BadRequestException("adminCourseView.scormExport.error.missingAsset");
    }
  }

  private rewriteSnapshotAssetReferences(
    snapshot: ScormExportCourseSnapshot,
    resolutionByAssetId: Map<string, AssetResolution>,
  ): ScormExportCourseSnapshot {
    return {
      ...snapshot,
      thumbnail: this.rewriteAsset(snapshot.thumbnail ?? null, resolutionByAssetId),
      logo: this.rewriteAsset(snapshot.logo ?? null, resolutionByAssetId),
      lessons: Object.fromEntries(
        Object.entries(snapshot.lessons).map(([lessonId, lesson]) => [
          lessonId,
          this.rewriteLesson(lesson, resolutionByAssetId),
        ]),
      ),
    };
  }

  private rewriteLesson(
    lesson: ScormExportLessonSnapshot,
    resolutionByAssetId: Map<string, AssetResolution>,
  ): ScormExportLessonSnapshot {
    if (lesson.type === "content") {
      const assets = lesson.assets.map((asset) => this.rewriteAsset(asset, resolutionByAssetId));

      return {
        ...lesson,
        html: this.rewriteContentHtml(lesson.html, assets),
        assets,
      };
    }

    if (lesson.type === "quiz") {
      return {
        ...lesson,
        questions: lesson.questions.map((question) => ({
          ...question,
          assets: question.assets.map((asset) => this.rewriteAsset(asset, resolutionByAssetId)),
        })),
      };
    }

    return lesson;
  }

  private rewriteAsset<T extends ScormExportAssetReference | null>(
    asset: T,
    resolutionByAssetId: Map<string, AssetResolution>,
  ): T {
    if (!asset) return asset;

    const resolution = resolutionByAssetId.get(asset.id);
    if (!resolution) return asset;

    return {
      ...asset,
      packagePath: resolution.packagePath,
    };
  }

  private rewriteContentHtml(html: string, assets: ScormExportAssetReference[]) {
    return assets.reduce((rewrittenHtml, asset) => {
      const replacement = this.isPackagePath(asset.packagePath)
        ? this.toPlayerRelativePath(asset.packagePath)
        : asset.packagePath;

      return rewrittenHtml.replace(this.resourceReferenceRegex(asset.id), replacement);
    }, html);
  }

  private getSnapshotAssets(snapshot: ScormExportCourseSnapshot) {
    return [
      snapshot.thumbnail,
      snapshot.logo,
      ...Object.values(snapshot.lessons).flatMap((lesson) => this.getLessonAssets(lesson)),
    ].filter(this.isAssetReference);
  }

  private getLessonAssets(lesson: ScormExportLessonSnapshot) {
    if (lesson.type === "content") return lesson.assets;
    if (lesson.type === "quiz") return lesson.questions.flatMap((question) => question.assets);
    return [];
  }

  private async collectImportedScormPackageFiles(snapshot: ScormExportCourseSnapshot) {
    const scormLessons = Object.values(snapshot.lessons).filter(
      (lesson): lesson is ScormExportImportedScormLessonSnapshot =>
        lesson.type === LESSON_TYPES.SCORM,
    );
    const packageFiles = await Promise.all(
      scormLessons.map(async (lesson) => {
        const references = await this.fileService.listFileReferencesByPrefix(
          lesson.extractedFilesReference,
        );

        return references
          .filter((reference) => !reference.endsWith("/"))
          .map((reference) => {
            const relativePath = this.stripReferencePrefix(
              lesson.extractedFilesReference,
              reference,
            );

            return {
              path: importedScormPackagePath(lesson.packageId, relativePath),
              streamFactory: async () => {
                const file = await this.fileService.getFileStream(reference);
                return file.stream;
              },
            };
          });
      }),
    );

    return packageFiles.flat();
  }

  private groupAssetsBySourceReference(assets: ScormExportAssetReference[]) {
    const assetsBySourceReference = new Map<string, ScormExportAssetReference[]>();

    assets.forEach((asset) => {
      const key = asset.sourceReference || asset.id;
      assetsBySourceReference.set(key, [...(assetsBySourceReference.get(key) ?? []), asset]);
    });

    return assetsBySourceReference;
  }

  private isAssetReference(
    asset: ScormExportAssetReference | null | undefined,
  ): asset is ScormExportAssetReference {
    return Boolean(asset);
  }

  private dedupeFiles(files: ScormExportPackageFile[]) {
    return Array.from(new Map(files.map((file) => [file.path, file])).values());
  }

  private shouldPreserveReference(reference: string) {
    return reference.startsWith("http://") || reference.startsWith("https://");
  }

  private isBunnyReference(reference: string) {
    return reference.startsWith("bunny-");
  }

  private resourceReferenceRegex(resourceId: string) {
    return new RegExp(
      `(?:https?:\\/\\/[^"'\\s>]+)?(?:\\/api\\/lesson\\/)?lesson-resource\\/${resourceId}`,
      "g",
    );
  }

  private toPlayerRelativePath(packagePath: string) {
    return `../${packagePath}`;
  }

  private isPackagePath(value: string) {
    return !value.startsWith("http://") && !value.startsWith("https://");
  }

  private stripReferencePrefix(prefix: string, reference: string) {
    const normalizedPrefix = `${prefix.replace(/\/+$/, "")}/`;

    if (!reference.startsWith(normalizedPrefix)) {
      return reference;
    }

    return reference.slice(normalizedPrefix.length);
  }
}
