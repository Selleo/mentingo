import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, UUIDType } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

import { scormMetadataSchema, scormUploadResponseSchema } from "./schemas/scorm.schema";
import { ScormService } from "./services/scorm.service";

@Controller("scorm")
@UseGuards(RolesGuard)
export class ScormController {
  constructor(private readonly scormService: ScormService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
        resource: {
          type: "string",
          description: "Optional resource type",
        },
      },
    },
  })
  @Validate({
    response: baseResponse(scormUploadResponseSchema),
  })
  async uploadScormPackage(
    @UploadedFile() file: Express.Multer.File,
    @Query("courseId") courseId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") role: UserRole,
  ) {
    if (!courseId) {
      throw new BadRequestException("courseId is required");
    }

    if (!file) {
      throw new BadRequestException("file is required");
    }

    const metadata = await this.scormService.processScormPackage(file, courseId, userId, role);

    return new BaseResponse({
      message: "SCORM package uploaded successfully",
      metadata,
    });
  }

  @Roles(...Object.values(USER_ROLES))
  @Get(":courseId/content")
  @Header("Cache-Control", "no-store")
  @Header("X-Frame-Options", "SAMEORIGIN")
  @Header(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.lms.localhost https://*.selleo.app",
  )
  async serveScormContent(
    @Param("courseId") courseId: UUIDType,
    @Query("path") filePath: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    if (!filePath) {
      throw new BadRequestException("filePath is required");
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const content = await this.scormService.serveContent(courseId, filePath, baseUrl);

    if (filePath.endsWith(".html")) {
      res.setHeader("Content-Type", "text/html");
      return res.send(content);
    }

    const contentType = this.scormService.getContentType(filePath);
    res.setHeader("Content-Type", contentType);

    if (typeof content === "string") {
      return res.redirect(content);
    }

    return res.send(content);
  }

  @Get(":courseId/metadata")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    request: [{ type: "param", name: "courseId", schema: UUIDSchema }],
    response: baseResponse(scormMetadataSchema),
  })
  async getScormMetadata(@Param("courseId") courseId: UUIDType) {
    const metadata = await this.scormService.getCourseScormMetadata(courseId);
    return new BaseResponse(metadata);
  }
}
