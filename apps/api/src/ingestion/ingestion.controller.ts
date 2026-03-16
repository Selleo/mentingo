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
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse, UUIDSchema, UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import { ALLOWED_FILE_TYPES_MAP, MAX_MB_PER_FILE } from "src/ingestion/ingestion.config";
import { getAllAssignedDocumentsSchema } from "src/ingestion/ingestion.schema";
import { IngestionService } from "src/ingestion/services/ingestion.service";

import type { GetAllAssignedDocumentsBody } from "src/ingestion/ingestion.schema";

@Controller("ingestion")
@UseGuards(PermissionsGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post("ingest")
  @RequirePermission(PERMISSIONS.INGESTION_MANAGE, PERMISSIONS.INGESTION_MANAGE_OWN)
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
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return { data: await this.ingestionService.ingest(lessonId, _files, currentUser) };
  }

  @Get(":lessonId")
  @RequirePermission(PERMISSIONS.INGESTION_MANAGE, PERMISSIONS.INGESTION_MANAGE_OWN)
  @Validate({
    request: [{ type: "param", name: "lessonId", schema: UUIDSchema }],
    response: baseResponse(getAllAssignedDocumentsSchema),
  })
  async getAllAssignedDocumentsForLesson(
    @Param("lessonId") lessonId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GetAllAssignedDocumentsBody>> {
    return new BaseResponse(
      await this.ingestionService.findAllDocumentsForLesson(lessonId, currentUser),
    );
  }

  @Delete(":documentLinkId")
  @RequirePermission(PERMISSIONS.INGESTION_MANAGE, PERMISSIONS.INGESTION_MANAGE_OWN)
  @Validate({
    request: [{ type: "param", name: "documentLinkId", schema: UUIDSchema }],
  })
  async deleteDocumentLink(
    @Param("documentLinkId") documentLinkId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    return new BaseResponse(
      await this.ingestionService.deleteDocumentLink(documentLinkId, currentUser),
    );
  }
}
