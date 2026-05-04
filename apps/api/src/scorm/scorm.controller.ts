import { Body, Controller, Post, Req, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { FileService } from "src/file/file.service";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import {
  CreateScormCourseFiles,
  SCORM_PACKAGE_FIELD,
  SCORM_THUMBNAIL_FIELD,
  ValidateScormCourseFilesPipe,
} from "./pipes/validate-scorm-course-files.pipe";
import { CreateScormCourseBody, createScormCourseSchema } from "./schemas/createScormCourse.schema";
import { CreateScormLessonBody, createScormLessonSchema } from "./schemas/createScormLesson.schema";
import { ScormService } from "./scorm.service";

@Controller("scorm")
export class ScormController {
  constructor(
    private readonly scormService: ScormService,
    private readonly fileService: FileService,
  ) {}

  @Post("course")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: SCORM_PACKAGE_FIELD, maxCount: 1 },
      { name: SCORM_THUMBNAIL_FIELD, maxCount: 1 },
    ]),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        categoryId: { type: "string", format: "uuid" },
        language: { type: "string" },
        status: { type: "string", enum: ["draft", "published", "private"] },
        thumbnailS3Key: { type: "string" },
        priceInCents: { type: "number" },
        currency: { type: "string" },
        hasCertificate: { type: "boolean" },
        scormPackage: { type: "string", format: "binary" },
        thumbnail: { type: "string", format: "binary" },
      },
      required: ["title", "description", "categoryId", "language", "scormPackage"],
    },
  })
  @Validate({
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createScormCourse(
    @Body(new ValidateMultipartPipe(createScormCourseSchema))
    createScormCourseBody: CreateScormCourseBody,
    @UploadedFiles(new ValidateScormCourseFilesPipe()) files: CreateScormCourseFiles,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() request: Request,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const scormPackage = files?.[SCORM_PACKAGE_FIELD]?.[0];
    const thumbnail = files?.[SCORM_THUMBNAIL_FIELD]?.[0];

    const thumbnailS3Key =
      createScormCourseBody.thumbnailS3Key ??
      (thumbnail
        ? (await this.fileService.uploadFile(thumbnail, "course", currentUser.tenantId)).fileKey
        : undefined);

    const isPlaywrightTest = Boolean(request.headers["x-playwright-test"]);
    const { id } = await this.scormService.createCourseImport({
      scormPackage: scormPackage!,
      metadata: {
        ...createScormCourseBody,
        thumbnailS3Key,
      },
      currentUser,
      isPlaywrightTest,
    });

    return new BaseResponse({
      id,
      message: "adminCourseView.toast.createCourseSuccessfully",
    });
  }

  @Post("lesson")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @UseInterceptors(FileFieldsInterceptor([{ name: SCORM_PACKAGE_FIELD, maxCount: 1 }]))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        chapterId: { type: "string", format: "uuid" },
        title: { type: "string" },
        scormPackage: { type: "string", format: "binary" },
      },
      required: ["chapterId", "title", "scormPackage"],
    },
  })
  @Validate({
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async createScormLesson(
    @Body(new ValidateMultipartPipe(createScormLessonSchema))
    createScormLessonBody: CreateScormLessonBody,
    @UploadedFiles(new ValidateScormCourseFilesPipe()) files: CreateScormCourseFiles,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const scormPackage = files?.[SCORM_PACKAGE_FIELD]?.[0];
    const { id } = await this.scormService.createLessonImport({
      scormPackage: scormPackage!,
      metadata: createScormLessonBody,
      currentUser,
    });

    return new BaseResponse({
      id,
      message: "adminCourseView.curriculum.lesson.toast.scormLessonCreatedSuccessfully",
    });
  }
}
