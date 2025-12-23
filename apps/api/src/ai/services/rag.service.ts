import { createOpenAI } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { embed } from "ai";

import { CHUNK_NEIGHBOURS, TOP_K_EMBEDDINGS } from "src/ai/ai.constants";
import { RagRepository } from "src/ai/repositories/rag.repository";
import { MESSAGE_ROLE, OPENAI_MODELS } from "src/ai/utils/ai.type";
import { EnvService } from "src/env/services/env.service";

import type { MessageRole } from "src/ai/utils/ai.type";
import type { UUIDType } from "src/common";

@Injectable()
export class RagService {
  constructor(
    private readonly ragRepository: RagRepository,
    private readonly envService: EnvService,
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
    const provider = await this.getAISdkOpenAI();
    const { embedding } = await embed({
      model: provider.textEmbeddingModel(OPENAI_MODELS.EMBEDDING),
      value: content,
      experimental_telemetry: { isEnabled: true },
    });

    return embedding;
  }

  async getAISdkOpenAI() {
    return createOpenAI({
      apiKey: await this.envService
        .getEnv("OPENAI_API_KEY")
        .then((r) => r.value)
        .catch(() => process.env.OPENAI_API_KEY),
    });
  }
}
