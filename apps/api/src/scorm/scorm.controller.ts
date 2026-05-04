import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { COURSE_TYPE, PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { CourseService } from "src/courses/course.service";
import { FileService } from "src/file/file.service";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import { CreateScormCourseBody, createScormCourseSchema } from "./schemas/createScormCourse.schema";
import { ScormService } from "./scorm.service";

const SCORM_PACKAGE_FIELD = "scormPackage";
const THUMBNAIL_FIELD = "thumbnail";
const MAX_SCORM_PACKAGE_SIZE = 500 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 20 * 1024 * 1024;
const ALLOWED_THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png", "image/svg+xml"];

type CreateScormCourseFiles = {
  [SCORM_PACKAGE_FIELD]?: Express.Multer.File[];
  [THUMBNAIL_FIELD]?: Express.Multer.File[];
};

@Controller("scorm")
export class ScormController {
  constructor(
    private readonly courseService: CourseService,
    private readonly scormService: ScormService,
    private readonly fileService: FileService,
  ) {}

  @Post("course")
  @RequirePermission(PERMISSIONS.COURSE_CREATE)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: SCORM_PACKAGE_FIELD, maxCount: 1 },
      { name: THUMBNAIL_FIELD, maxCount: 1 },
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
    @UploadedFiles() files: CreateScormCourseFiles,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() request: Request,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const scormPackage = files?.[SCORM_PACKAGE_FIELD]?.[0];
    const thumbnail = files?.[THUMBNAIL_FIELD]?.[0];

    this.validateScormPackage(scormPackage);
    this.validateThumbnail(thumbnail);

    const thumbnailS3Key =
      createScormCourseBody.thumbnailS3Key ??
      (thumbnail
        ? (await this.fileService.uploadFile(thumbnail, "course", currentUser.tenantId)).fileKey
        : undefined);

    const isPlaywrightTest = request.headers["x-playwright-test"];
    const { id } = await this.courseService.createCourse(
      {
        ...createScormCourseBody,
        status: createScormCourseBody.status ?? "draft",
        thumbnailS3Key,
        isScorm: true,
      },
      currentUser,
      !!isPlaywrightTest,
    );

    await this.scormService.prepareCoursePackage({
      courseId: id,
      scormPackage: scormPackage!,
      thumbnail,
      metadata: createScormCourseBody,
      currentUser,
    });

    return new BaseResponse({
      id,
      message: `${COURSE_TYPE.SCORM} course created successfully`,
    });
  }

  private validateScormPackage(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("SCORM package is required");
    }

    if (file.size > MAX_SCORM_PACKAGE_SIZE) {
      throw new BadRequestException("SCORM package must be less than 500MB");
    }

    if (!file.originalname.toLowerCase().endsWith(".zip")) {
      throw new BadRequestException("SCORM package must be a .zip file");
    }
  }

  private validateThumbnail(file?: Express.Multer.File) {
    if (!file) return;

    if (file.size > MAX_THUMBNAIL_SIZE) {
      throw new BadRequestException("Thumbnail must be less than 20MB");
    }

    if (!ALLOWED_THUMBNAIL_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Thumbnail must be an image file");
    }
  }
}
