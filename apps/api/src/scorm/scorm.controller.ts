import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Head,
  Headers,
  Options,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { DEFAULT_TUS_CHUNK_SIZE, PERMISSIONS, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { FileService } from "src/file/file.service";
import { streamFileToResponse } from "src/file/utils/streamFileToResponse";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import {
  CreateScormCourseFiles,
  SCORM_PACKAGE_FIELD,
  SCORM_THUMBNAIL_FIELD,
  ValidateScormCourseFilesPipe,
} from "./pipes/validate-scorm-course-files.pipe";
import { CreateScormCourseBody, createScormCourseSchema } from "./schemas/createScormCourse.schema";
import {
  AttachScormLessonPackageBody,
  attachScormLessonPackageSchema,
  CreateScormLessonBody,
  createScormLessonSchema,
} from "./schemas/createScormLesson.schema";
import {
  completeScormImportResponseSchema,
  initScormImportResponseSchema,
  initScormImportSchema,
  InitScormImportBody,
} from "./schemas/scormImport.schema";
import {
  scormLaunchResponseSchema,
  ScormRuntimeCommitBody,
  scormRuntimeCommitResponseSchema,
  scormRuntimeCommitSchema,
  ScormRuntimeFinishBody,
  scormRuntimeFinishResponseSchema,
  scormRuntimeFinishSchema,
} from "./schemas/scormRuntime.schema";
import { MAX_SCORM_PACKAGE_SIZE_BYTES } from "./scorm-package-limits";
import {
  SCORM_TUS_EXPOSED_HEADERS,
  SCORM_TUS_STATE_TTL,
  SCORM_TUS_VERSION,
} from "./scorm-tus-upload.constants";
import { ScormTusUploadService } from "./scorm-tus-upload.service";
import { ScormService } from "./scorm.service";

import type {
  CompleteScormImportResponse,
  InitScormImportResponse,
} from "./schemas/scormImport.schema";
import type {
  ScormLaunchResponse,
  ScormRuntimeCommitResponse,
  ScormRuntimeFinishResponse,
} from "./schemas/scormRuntime.schema";
@Controller("scorm")
export class ScormController {
  constructor(
    private readonly scormService: ScormService,
    private readonly fileService: FileService,
    private readonly scormTusUploadService: ScormTusUploadService,
  ) {}

  @Post("import/init")
  @RequirePermission(
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
  )
  @Validate({
    request: [{ type: "body", schema: initScormImportSchema }],
    response: initScormImportResponseSchema,
  })
  async initScormImport(
    @Body() body: InitScormImportBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<InitScormImportResponse> {
    const upload = await this.scormService.initTusImport({ importRequest: body, currentUser });

    await this.scormTusUploadService.createSession({
      ...upload,
      importRequest: body,
      currentUser,
    });

    return {
      packageId: upload.packageId,
      uploadId: upload.uploadId,
      tusEndpoint: "/api/scorm/import/tus",
      tusHeaders: {},
      expiresAt: new Date(Date.now() + SCORM_TUS_STATE_TTL).toISOString(),
      partSize: DEFAULT_TUS_CHUNK_SIZE,
    };
  }

  @Options("import/tus")
  async tusOptionsBase(@Res() res: Response) {
    this.setTusHeaders(res);
    return res.status(204).send();
  }

  @Options("import/tus/:packageId")
  async tusOptionsUpload(@Res() res: Response) {
    this.setTusHeaders(res);
    return res.status(204).send();
  }

  @Post("import/tus")
  @RequirePermission(
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
  )
  async createTusUpload(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser("userId") currentUserId: UUIDType,
  ) {
    this.ensureTusVersion(req);

    const metadata = this.parseTusMetadata(req.headers["upload-metadata"] as string | undefined);
    const packageId = metadata.uploadId as UUIDType | undefined;

    if (!packageId) {
      throw new BadRequestException("adminScorm.errors.uploadIdMissing");
    }

    const session = await this.scormTusUploadService.getSession(packageId);
    if (!session || session.userId !== currentUserId) {
      throw new BadRequestException("adminScorm.errors.uploadSessionNotFound");
    }

    const location = `/api/scorm/import/tus/${packageId}`;
    this.setTusHeaders(res, { Location: location });

    return res.status(201).send();
  }

  @Head("import/tus/:packageId")
  @RequirePermission(
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
  )
  async getTusUpload(
    @Param("packageId") packageId: UUIDType,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser("userId") currentUserId: UUIDType,
  ) {
    this.ensureTusVersion(req);

    const session = await this.scormTusUploadService.getSession(packageId);
    if (!session || session.userId !== currentUserId) {
      throw new BadRequestException("adminScorm.errors.uploadSessionNotFound");
    }

    this.setTusHeaders(res, {
      "Upload-Offset": String(session.offset),
      "Upload-Length": String(session.uploadLength),
    });

    return res.status(200).send();
  }

  @Patch("import/tus/:packageId")
  @RequirePermission(
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
  )
  async patchTusUpload(
    @Param("packageId") packageId: UUIDType,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser("userId") currentUserId: UUIDType,
  ) {
    this.ensureTusVersion(req);

    const uploadOffset = Number(req.headers["upload-offset"]);
    const chunk = req.body;

    if (Number.isNaN(uploadOffset)) {
      throw new BadRequestException("adminScorm.errors.uploadOffsetMissing");
    }

    const result = await this.scormTusUploadService.handlePatch(
      packageId,
      uploadOffset,
      chunk,
      currentUserId,
    );

    this.setTusHeaders(res, { "Upload-Offset": String(result.offset) });

    if (result.conflict) return res.status(409).send();

    return res.status(204).send();
  }

  @Post("import/:packageId/complete")
  @RequirePermission(
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_UPDATE_OWN,
  )
  @Validate({
    request: [{ type: "param", name: "packageId", schema: UUIDSchema }],
    response: baseResponse(completeScormImportResponseSchema),
  })
  async completeScormImport(
    @Param("packageId") packageId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CompleteScormImportResponse>> {
    const session = await this.scormTusUploadService.completeUpload(packageId, currentUser.userId);

    const result = await this.scormService.completeTusImport({ session, currentUser });

    await this.scormTusUploadService.clearSession(packageId);

    return new BaseResponse(result);
  }

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

    const thumbnailS3Key = await this.resolveThumbnailS3Key(
      createScormCourseBody.thumbnailS3Key,
      thumbnail,
      currentUser,
    );

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

  private async resolveThumbnailS3Key(
    existingThumbnailS3Key: string | undefined,
    thumbnail: Express.Multer.File | undefined,
    currentUser: CurrentUserType,
  ) {
    if (existingThumbnailS3Key) return existingThumbnailS3Key;
    if (!thumbnail) return undefined;

    const uploadedFile = await this.fileService.uploadFile(
      thumbnail,
      "course",
      currentUser.tenantId,
    );
    return uploadedFile.fileKey;
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
        language: { type: "string" },
        scormPackage: { type: "string", format: "binary" },
      },
      required: ["chapterId", "title", "language", "scormPackage"],
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

  @Patch("lesson/:lessonId/package")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: SCORM_PACKAGE_FIELD, maxCount: 1 },
      { name: SCORM_THUMBNAIL_FIELD, maxCount: 1 },
    ]),
  )
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        language: { type: "string" },
        scormPackage: { type: "string", format: "binary" },
      },
      required: ["title", "language", "scormPackage"],
    },
  })
  @Validate({
    request: [{ type: "param", name: "lessonId", schema: UUIDSchema }],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async attachScormLessonPackage(
    @Param("lessonId") lessonId: UUIDType,
    @Body(new ValidateMultipartPipe(attachScormLessonPackageSchema))
    attachScormLessonPackageBody: AttachScormLessonPackageBody,
    @UploadedFiles(new ValidateScormCourseFilesPipe()) files: CreateScormCourseFiles,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const scormPackage = files?.[SCORM_PACKAGE_FIELD]?.[0];
    const { id } = await this.scormService.attachLessonPackage({
      lessonId,
      scormPackage: scormPackage!,
      metadata: attachScormLessonPackageBody,
      currentUser,
    });

    return new BaseResponse({
      id,
      message: "adminCourseView.curriculum.lesson.toast.scormLessonPackageAttachedSuccessfully",
    });
  }

  @Get("runtime/launch")
  @RequirePermission(PERMISSIONS.COURSE_READ)
  @Validate({
    request: [
      { type: "query" as const, name: "lessonId", schema: UUIDSchema },
      { type: "query" as const, name: "scoId", schema: Type.Optional(UUIDSchema) },
      { type: "query" as const, name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(scormLaunchResponseSchema),
  })
  async launchScormAttempt(
    @Query("lessonId") lessonId: UUIDType,
    @Query("scoId") scoId: UUIDType | undefined,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ScormLaunchResponse>> {
    return new BaseResponse(
      await this.scormService.launchRuntime({ lessonId, scoId, language, currentUser }),
    );
  }

  @Post("runtime/commit")
  @RequirePermission(PERMISSIONS.COURSE_READ)
  @Validate({
    request: [{ type: "body", schema: scormRuntimeCommitSchema }],
    response: baseResponse(scormRuntimeCommitResponseSchema),
  })
  async commitScormAttempt(
    @Body() body: ScormRuntimeCommitBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ScormRuntimeCommitResponse>> {
    const result = await this.scormService.commitRuntime({ body, currentUser, finish: false });

    return new BaseResponse({
      committed: true,
      ...result,
    });
  }

  @Post("runtime/finish")
  @RequirePermission(PERMISSIONS.COURSE_READ)
  @Validate({
    request: [{ type: "body", schema: scormRuntimeFinishSchema }],
    response: baseResponse(scormRuntimeFinishResponseSchema),
  })
  async finishScormAttempt(
    @Body() body: ScormRuntimeFinishBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<ScormRuntimeFinishResponse>> {
    const result = await this.scormService.commitRuntime({ body, currentUser, finish: true });

    return new BaseResponse({
      finished: true,
      ...result,
    });
  }

  @Get("content/:packageId/*")
  @RequirePermission(PERMISSIONS.COURSE_READ)
  @Validate({
    request: [{ type: "param", name: "packageId", schema: UUIDSchema }],
  })
  async streamScormContent(
    @Param("packageId") packageId: UUIDType,
    @Req() request: Request,
    @Res() response: Response,
    @Headers("range") range: string | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    const relativePath = request.params[0];
    const file = await this.scormService.getContentFile({
      packageId,
      relativePath,
      range,
      currentUser,
    });

    streamFileToResponse(response, file);
  }

  private ensureTusVersion(req: Request) {
    if (req.headers["tus-resumable"] !== SCORM_TUS_VERSION) {
      throw new BadRequestException("adminScorm.errors.unsupportedTusVersion");
    }
  }

  private parseTusMetadata(header?: string) {
    if (!header) return {};

    return Object.fromEntries(
      header.split(",").map((part) => {
        const [key, encodedValue] = part.trim().split(" ");
        if (!encodedValue) return [key, ""];

        return [key, Buffer.from(encodedValue, "base64").toString("utf8")];
      }),
    );
  }

  private setTusHeaders(res: Response, extraHeaders: Record<string, string> = {}) {
    res.set({
      "Tus-Resumable": SCORM_TUS_VERSION,
      "Tus-Version": SCORM_TUS_VERSION,
      "Tus-Extension": "creation",
      "Tus-Max-Size": String(MAX_SCORM_PACKAGE_SIZE_BYTES),
      "Access-Control-Expose-Headers": SCORM_TUS_EXPOSED_HEADERS,
      ...extraHeaders,
    });
  }
}
