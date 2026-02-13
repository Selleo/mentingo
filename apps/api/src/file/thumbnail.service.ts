import { spawn } from "node:child_process";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ENTITY_TYPES,
  VIDEO_EMBED_PROVIDERS,
  detectVideoProviderFromUrl,
  extractResourceIdFromSourceUrl,
  extractVideoIdFromSourceUrl,
  type VideoProvider,
} from "@repo/shared";
import axios from "axios";
import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { DatabasePg } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { S3Service } from "src/s3/s3.service";
import {
  articles,
  chapters,
  courses,
  lessons,
  news,
  resources,
  resourceEntity,
  settings,
  studentCourses,
} from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { BASE_THUMBNAIL_CONTENT_TYPE, getVideoThumbnailKey } from "./utils/videoThumbnail";

import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class ThumbnailService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly bunnyStreamService: BunnyStreamService,
    @Inject("DB") private readonly db: DatabasePg,
  ) {}

  async getThumbnail(sourceUrl: string, provider: VideoProvider, currentUser: CurrentUser | null) {
    if (!sourceUrl) throw new BadRequestException("Missing sourceUrl");

    const resolvedProvider =
      provider === VIDEO_EMBED_PROVIDERS.UNKNOWN ? detectVideoProviderFromUrl(sourceUrl) : provider;

    if (resolvedProvider === VIDEO_EMBED_PROVIDERS.SELF) {
      return this.getInternalThumbnail(sourceUrl, currentUser);
    }

    return this.getExternalThumbnail(sourceUrl, resolvedProvider);
  }

  private async getInternalThumbnail(sourceUrl: string, currentUser: CurrentUser | null) {
    const resourceId = extractResourceIdFromSourceUrl(sourceUrl);
    if (!resourceId) throw new BadRequestException("Invalid sourceUrl");

    const [resource] = await this.db
      .select({
        ...getTableColumns(resources),
        entityType: resourceEntity.entityType,
        entityId: resourceEntity.entityId,
      })
      .from(resources)
      .innerJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
      .where(eq(resources.id, resourceId));

    if (!resource) throw new BadRequestException("common.toast.notFound");

    await this.validateThumbnailAccess(resource, currentUser);

    if (resource.reference.startsWith("bunny-")) {
      const videoId = resource.reference.replace("bunny-", "");
      return this.bunnyStreamService.getThumbnailUrl(videoId);
    }

    const exists = await this.s3Service.getFileExists(getVideoThumbnailKey(resourceId));
    if (!exists) await this.extractThumbnail(resource.reference, resourceId);

    return this.s3Service.getSignedUrl(getVideoThumbnailKey(resource.id));
  }

  private async getExternalThumbnail(sourceUrl: string, provider: VideoProvider) {
    if (provider === VIDEO_EMBED_PROVIDERS.UNKNOWN) {
      throw new BadRequestException("Unsupported video provider");
    }

    const videoId = extractVideoIdFromSourceUrl(sourceUrl, provider);
    if (!videoId) throw new BadRequestException("Invalid sourceUrl");

    switch (provider) {
      case VIDEO_EMBED_PROVIDERS.BUNNY:
        return this.bunnyStreamService.getThumbnailUrl(videoId);
      case VIDEO_EMBED_PROVIDERS.YOUTUBE:
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      case VIDEO_EMBED_PROVIDERS.VIMEO:
        return this.getVimeoThumbnailUrl(videoId);
      default:
        throw new BadRequestException("Unsupported video provider");
    }
  }

  private async getVimeoThumbnailUrl(videoId: string) {
    const response = await axios.get<{ thumbnail_url?: string }>(
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`,
    );

    if (!response.data?.thumbnail_url) {
      throw new BadRequestException("Missing Vimeo thumbnail");
    }

    return response.data.thumbnail_url;
  }

  private async validateThumbnailAccess(
    resource: { entityType: string; entityId: UUIDType },
    currentUser: CurrentUser | null,
  ) {
    switch (resource.entityType) {
      case ENTITY_TYPES.ARTICLES:
        await this.validateArticleThumbnailAccess(resource.entityId, currentUser);
        return;
      case ENTITY_TYPES.NEWS:
        await this.validateNewsThumbnailAccess(resource.entityId, currentUser);
        return;
      case ENTITY_TYPES.LESSON:
        await this.validateLessonThumbnailAccess(resource.entityId, currentUser);
        return;
      default:
        return;
    }
  }

  private async getGlobalSettingsFlags() {
    const [globalSettings] = await this.db
      .select({ settings: sql<Record<string, unknown>>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    return (globalSettings?.settings ?? {}) as Record<string, unknown>;
  }

  private isAdminLike(currentUser: CurrentUser | null) {
    return (
      currentUser?.role === USER_ROLES.ADMIN || currentUser?.role === USER_ROLES.CONTENT_CREATOR
    );
  }

  private async validateArticleThumbnailAccess(
    resourceEntityId: UUIDType,
    currentUser: CurrentUser | null,
  ) {
    const { articlesEnabled, unregisteredUserArticlesAccessibility } =
      await this.getGlobalSettingsFlags();

    const hasAccess = Boolean(
      articlesEnabled && (currentUser?.userId || unregisteredUserArticlesAccessibility),
    );

    if (!hasAccess) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }

    const [article] = await this.db
      .select({
        authorId: articles.authorId,
        isPublic: articles.isPublic,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .where(eq(articles.id, resourceEntityId));

    if (!article) throw new NotFoundException("Article resource not found");

    const isAuthor = Boolean(currentUser?.userId && article.authorId === currentUser.userId);
    const isPublic = Boolean(article.isPublic && article.publishedAt !== null);

    if (!this.isAdminLike(currentUser) && !isAuthor && !isPublic) {
      throw new NotFoundException("Article resource not found");
    }
  }

  private async validateNewsThumbnailAccess(
    resourceEntityId: UUIDType,
    currentUser: CurrentUser | null,
  ) {
    const { newsEnabled, unregisteredUserNewsAccessibility } = await this.getGlobalSettingsFlags();

    const hasAccess = Boolean(
      newsEnabled && (currentUser?.userId || unregisteredUserNewsAccessibility),
    );

    if (!hasAccess) {
      throw new ForbiddenException({ message: "common.toast.noAccess" });
    }

    const [newsItem] = await this.db
      .select({
        authorId: news.authorId,
        isPublic: news.isPublic,
        publishedAt: news.publishedAt,
      })
      .from(news)
      .where(eq(news.id, resourceEntityId));

    if (!newsItem) throw new NotFoundException("News resource not found");

    const isAuthor = Boolean(currentUser?.userId && newsItem.authorId === currentUser.userId);
    const isPublic = Boolean(newsItem.isPublic && newsItem.publishedAt !== null);

    if (!this.isAdminLike(currentUser) && !isAuthor && !isPublic) {
      throw new NotFoundException("News resource not found");
    }
  }

  private async validateLessonThumbnailAccess(
    resourceEntityId: UUIDType,
    currentUser: CurrentUser | null,
  ) {
    const currentUserId = currentUser?.userId;

    const [lessonAccess] = await this.db
      .select({
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.status} IS NOT NULL THEN TRUE ELSE FALSE END`,
        isFreemium: sql<boolean>`CASE WHEN ${chapters.isFreemium} THEN TRUE ELSE FALSE END`,
        courseAuthorId: courses.authorId,
        chapterAuthorId: chapters.authorId,
      })
      .from(lessons)
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .leftJoin(courses, eq(chapters.courseId, courses.id))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, chapters.courseId),
          eq(studentCourses.studentId, currentUserId ?? ""),
        ),
      )
      .where(eq(lessons.id, resourceEntityId));

    if (!lessonAccess) {
      throw new NotFoundException("Lesson resource not found");
    }

    const isAuthor = Boolean(
      currentUserId &&
        (lessonAccess.courseAuthorId === currentUserId ||
          lessonAccess.chapterAuthorId === currentUserId),
    );

    if (this.isAdminLike(currentUser) || isAuthor) {
      return;
    }

    if (lessonAccess.isFreemium) {
      return;
    }

    if (!lessonAccess.isAssigned) {
      throw new ForbiddenException("You are not allowed to access this lesson!");
    }
  }

  private async extractThumbnail(reference: string, resourceId: UUIDType) {
    const signedUrl = await this.s3Service.getSignedUrl(reference);
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",

      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "2",

      "-ss",
      "0",
      "-i",
      signedUrl,

      "-frames:v",
      "1",
      "-vf",
      "scale=640:-1",
      "-f",
      "mjpeg",
      "-q:v",
      "2",
      "pipe:1",
    ];

    const ffmpegBin = "ffmpeg";

    const ffmpeg = spawn(ffmpegBin, args);
    let ffmpegExited = false;

    const terminateFfmpeg = () => {
      if (ffmpegExited || ffmpeg.killed) return;
      try {
        ffmpeg.kill("SIGKILL");
      } catch {}
    };

    const chunks: Buffer[] = [];
    let stderr = "";

    ffmpeg.on("close", () => {
      ffmpegExited = true;
    });

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    ffmpeg.stderr.on("end", () => {});
    ffmpeg.stdout.on("end", () => {});

    let exitCode: number;
    try {
      exitCode = await new Promise<number>((resolve, reject) => {
        ffmpeg.on("error", (error) => {
          terminateFfmpeg();
          reject(error);
        });
        ffmpeg.on("close", (code) => resolve(code ?? -1));
        ffmpeg.stdout.on("error", (error) => {
          terminateFfmpeg();
          reject(error);
        });
        ffmpeg.stderr.on("error", (error) => {
          terminateFfmpeg();
          reject(error);
        });
      });
    } catch (error) {
      terminateFfmpeg();
      const spawnError = error as NodeJS.ErrnoException;

      if (spawnError?.code === "ENOENT") {
        throw new Error("Failed to extract thumbnail: ffmpeg binary not found in PATH.");
      }

      if (spawnError?.code === "EACCES") {
        throw new Error("Failed to extract thumbnail: ffmpeg is not executable.");
      }

      throw new Error(
        `Failed to start ffmpeg process${spawnError?.code ? ` (${spawnError.code})` : ""}: ${
          spawnError?.message ?? "Unknown error"
        }`,
      );
    } finally {
      terminateFfmpeg();
    }

    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with code ${exitCode}: ${stderr}`);
    }

    const output = Buffer.concat(chunks);
    if (output.length === 0) {
      throw new Error("ffmpeg produced empty thumbnail output");
    }

    await this.db.transaction(async (trx) => {
      await this.s3Service.uploadFile(
        output,
        getVideoThumbnailKey(resourceId),
        BASE_THUMBNAIL_CONTENT_TYPE,
      );
      await trx
        .update(resources)
        .set({
          metadata: setJsonbField(
            resources.metadata,
            "thumbnail",
            getVideoThumbnailKey(resourceId),
          ),
        })
        .where(eq(resources.id, resourceId));
    });
  }
}
