import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, baseResponse } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CsvXlsxProcessorService } from "src/file/csv-xlsx-processor.service";
import { ValidateMultipartPipe } from "src/utils/pipes/validateMultipartPipe";

import { BulkUserService } from "./bulk-user.service";
import { ImportValidationService } from "./import-validation.service";
import {
  userImportRequestSchema,
  userImportResponseSchema,
  userImportErrorResponseSchema,
  type UserImportRequest,
  type UserImportResponse,
  type UserImportErrorResponse,
} from "./schemas/userImport.schema";
import { USER_ROLES } from "./schemas/userRoles";

@Controller("user/import")
@UseGuards(RolesGuard)
export class UserImportController {
  constructor(
    private readonly csvXlsxProcessorService: CsvXlsxProcessorService,
    private readonly bulkUserService: BulkUserService,
    private readonly importValidationService: ImportValidationService,
  ) {}

  @Post()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "CSV or XLSX file containing user data",
        },
        data: {
          type: "string",
          description: "JSON string with import options",
        },
      },
      required: ["file"],
    },
  })
  @Validate({
    response: baseResponse(Type.Union([userImportResponseSchema, userImportErrorResponseSchema])),
  })
  async importUsers(
    @Body(new ValidateMultipartPipe(userImportRequestSchema))
    requestData: { data: UserImportRequest },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BaseResponse<UserImportResponse | UserImportErrorResponse>> {
    if (!file) {
      throw new BadRequestException("File is required for user import");
    }

    try {
      // Process CSV/XLSX file
      const userData = await this.csvXlsxProcessorService.processUserImportFile(file);

      // Validate all data
      const validationResult = await this.importValidationService.validateImport(userData);

      // If validation fails, return errors
      if (!validationResult.isValid) {
        const errorResponse: UserImportErrorResponse = {
          message: "Import validation failed",
          errors: validationResult.errors,
          totalRows: userData.length,
        };

        return new BaseResponse(errorResponse);
      }

      // If validateOnly is true, return success without creating users
      // NOTE: probably not needed, but who knows :)
      if (requestData.data?.validateOnly) {
        const response: UserImportResponse = {
          message: "Validation successful - no users created (validation mode)",
          successCount: 0,
          totalRows: userData.length,
          createdUsers: [],
        };

        return new BaseResponse(response);
      }

      // Create users
      const result = await this.bulkUserService.createUsersInBulk(
        userData,
        requestData.data?.sendWelcomeEmail,
      );

      const response: UserImportResponse = {
        message: `Successfully imported ${result.successCount} users`,
        successCount: result.successCount,
        totalRows: result.totalRows,
        createdUsers: result.createdUsers,
      };

      // Log successful import for audit
      console.log(`User import completed: ${result.successCount} users created`, {
        totalRows: result.totalRows,
        timestamp: new Date().toISOString(),
      });

      return new BaseResponse(response);
    } catch (error) {
      // Log error for audit
      console.error("User import failed:", {
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }
}
