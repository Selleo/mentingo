import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { BadRequestException, Injectable } from "@nestjs/common";
import { TextLoader } from "langchain/document_loaders/fs/text";

import { ALLOWED_FILE_TYPES_MAP } from "src/ingestion/ingestion.config";

import type { TextExtractionBody } from "src/ingestion/ingestion.schema";

@Injectable()
export class ChunkService {
  constructor() {}

  async extractText(file: Express.Multer.File): Promise<TextExtractionBody> {
    const fileBlob = new Blob([file.buffer], { type: file?.mimetype });
    switch (file.mimetype) {
      case ALLOWED_FILE_TYPES_MAP.PDF: {
        const loader = new PDFLoader(fileBlob);
        return loader.load();
      }

      case ALLOWED_FILE_TYPES_MAP.DOCX: {
        const loader = new DocxLoader(fileBlob);
        return loader.load();
      }

      case ALLOWED_FILE_TYPES_MAP.TXT: {
        const loader = new TextLoader(fileBlob);
        return loader.load();
      }

      default: {
        throw new BadRequestException("This filetype is not allowed");
      }
    }
  }

  async chunkPages(pages: TextExtractionBody): Promise<TextExtractionBody> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 256,
      chunkOverlap: 0,
    });

    return splitter.splitDocuments(pages);
  }
}
