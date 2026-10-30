import { HttpStatus, Injectable, type PipeTransform } from "@nestjs/common";
import {
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
} from "@repo/shared";

import { MAX_VIDEO_SIZE } from "src/file/file.constants";

import { getBaseFileTypePipe } from "./utils/baseFileTypePipe";
import { buildFileTypeRegex } from "./utils/fileTypeRegex";
import { validateAudioUpload } from "./utils/validate-audio";

@Injectable()
export class LessonUploadFilePipe implements PipeTransform {
  private readonly legacyPipe = getBaseFileTypePipe(
    buildFileTypeRegex([
      ...ALLOWED_PDF_FILE_TYPES,
      ...ALLOWED_EXCEL_FILE_TYPES,
      ...ALLOWED_WORD_FILE_TYPES,
      ...ALLOWED_VIDEO_FILE_TYPES,
      ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
      ...ALLOWED_PRESENTATION_FILE_TYPES,
    ]),
    MAX_VIDEO_SIZE,
  ).build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST });

  async transform(file: Express.Multer.File) {
    if (file?.path) {
      await validateAudioUpload(file);
      return file;
    }
    return this.legacyPipe.transform(file);
  }
}
