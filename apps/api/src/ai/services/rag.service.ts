import { Injectable } from "@nestjs/common";

import { CHUNK_NEIGHBOURS, TOP_K_EMBEDDINGS } from "src/ai/ai.constants";
import { RagRepository } from "src/ai/repositories/rag.repository";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { MESSAGE_ROLE } from "src/ai/utils/ai.type";

import type { MessageRole } from "src/ai/utils/ai.type";
import type { UUIDType } from "src/common";

@Injectable()
export class RagService {
  constructor(
    private readonly ragRepository: RagRepository,
    private readonly aiRuntimeService: AiRuntimeService,
  ) {}

  async getContext(
    content: string,
    lessonId: UUIDType,
    neighbours: number = CHUNK_NEIGHBOURS,
  ): Promise<{
    chunks: {
      role: MessageRole;
      content: string;
      documentId: unknown;
      chunkIndex: unknown;
      similarityScore: unknown;
      fileName: unknown;
    }[];
  }> {
    const embedding = await this.getEmbedding(content);

    const chunks = await this.ragRepository.findTopKDocumentChunksWithNeighboursForAiMentorLesson(
      lessonId,
      embedding,
      TOP_K_EMBEDDINGS,
      neighbours,
    );

    return {
      chunks: chunks.map((chunk) => ({
        role: MESSAGE_ROLE.SYSTEM as MessageRole,
        content: `[RAG] ${chunk.content}` as string,
        documentId: chunk.document_id,
        chunkIndex: chunk.chunk_index,
        similarityScore: chunk.similarity_score,
        fileName: chunk.file_name,
      })),
    };
  }

  private async getEmbedding(content: string) {
    return this.aiRuntimeService.createEmbedding(content);
  }

  async getEmbeddings(contents: string[]) {
    return this.aiRuntimeService.createEmbeddings(contents);
  }

  async getAISdkOpenAI() {
    return this.aiRuntimeService.getAISdkOpenAI();
  }
}
