import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { and, eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { FileService } from "src/file/file.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { courseStudentMode, courses, studentCourses } from "src/storage/schema";

import { DELETED_COMMENT_PLACEHOLDER } from "../courseComments.constants";
import { CourseCommentsRepository } from "../repositories/courseComments.repository";
import { COMMENTS_PAGE_SIZE, INLINED_REPLIES_PER_COMMENT } from "../schemas/courseComment.schema";

import type { CourseCommentRow } from "../repositories/courseComments.repository";
import type {
  CourseComment,
  CourseCommentWithReplies,
  CreateCourseCommentBody,
  ListCourseCommentsResponse,
  ListRepliesResponse,
  UpdateCourseCommentBody,
} from "../schemas/courseComment.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

type CursorParts = { createdAt: string; id: string };

const encodeCursor = (parts: CursorParts) =>
  Buffer.from(`${parts.createdAt}|${parts.id}`).toString("base64url");

const decodeCursor = (raw?: string): CursorParts | undefined => {
  if (!raw) return undefined;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf-8");
    const [createdAt, id] = decoded.split("|");
    if (!createdAt || !id) return undefined;
    return { createdAt, id };
  } catch {
    return undefined;
  }
};

@Injectable()
export class CourseCommentsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly repo: CourseCommentsRepository,
    private readonly permissionsService: PermissionsService,
    private readonly fileService: FileService,
  ) {}

  async listComments(
    courseId: UUIDType,
    currentUser: CurrentUserType,
    cursor?: string,
  ): Promise<ListCourseCommentsResponse> {
    await this.assertReadAccess(courseId, currentUser);

    const decoded = decodeCursor(cursor);
    const rows = await this.repo.listTopLevel(courseId, COMMENTS_PAGE_SIZE + 1, decoded);
    const hasNext = rows.length > COMMENTS_PAGE_SIZE;
    const page = hasNext ? rows.slice(0, COMMENTS_PAGE_SIZE) : rows;

    const parentIds = page.map((row) => row.id);
    const inlinedReplies = await this.repo.listInlinedReplies(
      parentIds,
      INLINED_REPLIES_PER_COMMENT,
    );

    const repliesByParent = new Map<UUIDType, CourseCommentRow[]>();
    for (const reply of inlinedReplies) {
      const list = repliesByParent.get(reply.parentCommentId!) ?? [];
      list.push(reply);
      repliesByParent.set(reply.parentCommentId!, list);
    }

    const allRows = [...page, ...inlinedReplies];
    const avatarUrls = await this.resolveAvatarUrls(allRows);

    const data: CourseCommentWithReplies[] = page
      .map((row) => {
        const replies = (repliesByParent.get(row.id) ?? [])
          .filter((reply) => reply.deletedAt === null)
          .map((reply) => this.serializeRow(reply, avatarUrls));

        if (row.deletedAt !== null && row.replyCount === 0) return null;

        return {
          ...this.serializeRow(row, avatarUrls),
          replies,
        };
      })
      .filter((item): item is CourseCommentWithReplies => item !== null);

    const last = page[page.length - 1];

    return {
      data,
      nextCursor: hasNext && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  async listReplies(
    courseId: UUIDType,
    parentCommentId: UUIDType,
    currentUser: CurrentUserType,
    cursor?: string,
  ): Promise<ListRepliesResponse> {
    await this.assertReadAccess(courseId, currentUser);

    const parent = await this.repo.findCommentById(parentCommentId);
    if (!parent || parent.courseId !== courseId) {
      throw new NotFoundException("courseDiscussion.toast.commentNotFound");
    }

    const decoded = decodeCursor(cursor);
    const rows = await this.repo.listReplies(parentCommentId, COMMENTS_PAGE_SIZE + 1, decoded);
    const hasNext = rows.length > COMMENTS_PAGE_SIZE;
    const page = hasNext ? rows.slice(0, COMMENTS_PAGE_SIZE) : rows;

    const filtered = page.filter((row) => row.deletedAt === null);
    const avatarUrls = await this.resolveAvatarUrls(filtered);
    const data = filtered.map((row) => this.serializeRow(row, avatarUrls));
    const last = page[page.length - 1];

    return {
      data,
      nextCursor: hasNext && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  async createComment(
    courseId: UUIDType,
    body: CreateCourseCommentBody,
    currentUser: CurrentUserType,
  ): Promise<CourseComment> {
    await this.assertReadAccess(courseId, currentUser);

    const trimmed = body.content?.trim();
    if (!trimmed) {
      throw new BadRequestException("courseDiscussion.toast.contentRequired");
    }

    let parentCommentId: UUIDType | null = null;
    if (body.parentCommentId) {
      const parent = await this.repo.findCommentById(body.parentCommentId);
      if (!parent || parent.courseId !== courseId) {
        throw new NotFoundException("courseDiscussion.toast.commentNotFound");
      }
      if (parent.parentCommentId !== null) {
        throw new BadRequestException("courseDiscussion.toast.repliesToRepliesNotAllowed");
      }
      parentCommentId = parent.id;
    }

    const inserted = await this.repo.transaction(async (tx) => {
      const row = await this.repo.createComment(
        {
          courseId,
          authorId: currentUser.userId,
          parentCommentId,
          content: trimmed,
        },
        tx,
      );

      if (parentCommentId) {
        await this.repo.incrementReplyCount(parentCommentId, tx);
      }

      return row;
    });

    const avatarUrls = await this.resolveAvatarUrls([inserted]);
    return this.serializeRow(inserted, avatarUrls);
  }

  async updateComment(
    commentId: UUIDType,
    body: UpdateCourseCommentBody,
    currentUser: CurrentUserType,
  ): Promise<CourseComment> {
    const existing = await this.repo.findCommentById(commentId);
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException("courseDiscussion.toast.commentNotFound");
    }

    if (existing.authorId !== currentUser.userId) {
      throw new ForbiddenException("courseDiscussion.toast.notAuthorized");
    }

    await this.assertReadAccess(existing.courseId, currentUser);

    const trimmed = body.content?.trim();
    if (!trimmed) {
      throw new BadRequestException("courseDiscussion.toast.contentRequired");
    }

    await this.repo.updateContent(commentId, trimmed);
    const refreshed = await this.repo.findCommentById(commentId);

    const avatarUrls = await this.resolveAvatarUrls([refreshed!]);
    return this.serializeRow(refreshed!, avatarUrls);
  }

  async deleteComment(commentId: UUIDType, currentUser: CurrentUserType): Promise<void> {
    const existing = await this.repo.findCommentById(commentId);
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException("courseDiscussion.toast.commentNotFound");
    }

    const course = await this.repo.findCourse(existing.courseId);
    if (!course) {
      throw new NotFoundException("courseDiscussion.toast.commentNotFound");
    }

    const isAuthor = existing.authorId === currentUser.userId;
    const isCourseAuthor = course.authorId === currentUser.userId;
    const isAdmin = currentUser.permissions.includes(PERMISSIONS.COURSE_UPDATE);

    if (!isAuthor && !isCourseAuthor && !isAdmin) {
      throw new ForbiddenException("courseDiscussion.toast.notAuthorized");
    }

    await this.repo.transaction(async (tx) => {
      if (existing.parentCommentId === null && existing.replyCount > 0) {
        await this.repo.softDelete(commentId, tx);
      } else if (existing.parentCommentId !== null) {
        await this.repo.softDelete(commentId, tx);
        await this.repo.decrementReplyCount(existing.parentCommentId, tx);
      } else {
        await this.repo.softDelete(commentId, tx);
      }
    });
  }

  async getCommentCountForCourse(courseId: UUIDType): Promise<number> {
    return this.repo.countNonDeletedForCourse(courseId);
  }

  private serializeRow(
    row: CourseCommentRow,
    avatarUrls: Map<string, string | null>,
  ): CourseComment {
    const isDeleted = row.deletedAt !== null;
    const author =
      row.authorFirstName !== null
        ? {
            id: row.authorId,
            firstName: row.authorFirstName,
            lastName: row.authorLastName ?? "",
            profilePictureUrl: row.authorAvatarReference
              ? (avatarUrls.get(row.authorAvatarReference) ?? null)
              : null,
          }
        : null;

    return {
      id: row.id,
      courseId: row.courseId,
      parentCommentId: row.parentCommentId,
      content: isDeleted ? DELETED_COMMENT_PLACEHOLDER : row.content,
      isDeleted,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      replyCount: row.replyCount,
      author: isDeleted ? null : author,
    };
  }

  private async resolveAvatarUrls(rows: CourseCommentRow[]): Promise<Map<string, string | null>> {
    const refs = Array.from(
      new Set(
        rows
          .map((row) => row.authorAvatarReference)
          .filter((ref): ref is string => typeof ref === "string" && ref.length > 0),
      ),
    );

    const entries = await Promise.all(
      refs.map(async (ref) => {
        try {
          const url = await this.fileService.getFileUrl(ref);
          return [ref, url] as const;
        } catch {
          return [ref, null] as const;
        }
      }),
    );

    return new Map(entries);
  }

  private async assertReadAccess(courseId: UUIDType, currentUser: CurrentUserType) {
    const course = await this.repo.findCourse(courseId);
    if (!course) {
      throw new NotFoundException("courseDiscussion.toast.courseNotFound");
    }

    const { permissions } = await this.permissionsService.getUserAccess(currentUser.userId);

    const isAdmin = permissions.includes(PERMISSIONS.COURSE_UPDATE);
    const isCourseAuthor = course.authorId === currentUser.userId;

    if (isCourseAuthor) return;

    const [access] = await this.db
      .select({
        isAssigned: studentCourses.id,
        isStudentMode: courseStudentMode.id,
      })
      .from(courses)
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, courses.id),
          eq(studentCourses.studentId, currentUser.userId),
        ),
      )
      .leftJoin(
        courseStudentMode,
        and(
          eq(courseStudentMode.courseId, courses.id),
          eq(courseStudentMode.userId, currentUser.userId),
        ),
      )
      .where(eq(courses.id, courseId));

    const isEnrolled = !!access?.isAssigned;
    const isInStudentMode = !!access?.isStudentMode;

    if (isAdmin && !isInStudentMode) return;

    if (!isEnrolled) {
      throw new ForbiddenException("courseDiscussion.toast.notEnrolled");
    }
  }
}
