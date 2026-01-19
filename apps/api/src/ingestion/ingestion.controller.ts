import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { ALLOWED_FILE_TYPES_MAP, MAX_MB_PER_FILE } from "src/ingestion/ingestion.config";
import { getAllAssignedDocumentsSchema } from "src/ingestion/ingestion.schema";
import { IngestionService } from "src/ingestion/services/ingestion.service";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

import type { GetAllAssignedDocumentsBody } from "src/ingestion/ingestion.schema";

@Controller("ingestion")
@UseGuards(RolesGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post("ingest")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
  @UseInterceptors(FilesInterceptor("files"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        lessonId: { type: "string", format: "uuid" },
        files: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
      },
      required: ["lessonId", "files"],
    },
  })
  async ingest(
    @Body("lessonId") lessonId: UUIDType,
    @UploadedFiles(
      getBaseFileTypePipe(
        buildFileTypeRegex(Object.values(ALLOWED_FILE_TYPES_MAP)),
        MAX_MB_PER_FILE * 1024 * 1024,
        true,
      ).build({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    _files: Express.Multer.File[],
    @CurrentUser("role") role: UserRole,
    @CurrentUser("userId") userId: UUIDType,
  ) {
    return { data: await this.ingestionService.ingest(lessonId, _files, userId, role) };
  }

  @Get(":lessonId")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "param", name: "lessonId", schema: UUIDSchema }],
    response: baseResponse(getAllAssignedDocumentsSchema),
  })
  async getAllAssignedDocumentsForLesson(
    @Param("lessonId") lessonId: UUIDType,
    @CurrentUser("role") role: UserRole,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<GetAllAssignedDocumentsBody>> {
    return new BaseResponse(
      await this.ingestionService.findAllDocumentsForLesson(lessonId, userId, role),
    );
  }

  @Delete(":documentLinkId")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "param", name: "documentLinkId", schema: UUIDSchema }],
  })
  async deleteDocumentLink(
    @Param("documentLinkId") documentLinkId: UUIDType,
    @CurrentUser("role") role: UserRole,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<{ message: string }>> {
    return new BaseResponse(
      await this.ingestionService.deleteDocumentLink(documentLinkId, userId, role),
    );
  }
}
