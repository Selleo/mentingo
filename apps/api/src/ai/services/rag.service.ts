import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { embed } from "ai";

import { CHUNK_NEIGHBOURS, TOP_K_EMBEDDINGS } from "src/ai/ai.constants";
import { RagRepository } from "src/ai/repositories/rag.repository";
import { MESSAGE_ROLE, OPENAI_MODELS } from "src/ai/utils/ai.type";

import type { MessageRole } from "src/ai/utils/ai.type";
import type { UUIDType } from "src/common";

@Injectable()
export class RagService {
  constructor(private readonly ragRepository: RagRepository) {}

  async getContext(content: string, lessonId: UUIDType, neighbours: number = CHUNK_NEIGHBOURS) {
    const embedding = await this.getEmbedding(content);

    const chunks = await this.ragRepository.findTopKDocumentChunksWithNeighboursForAiMentorLesson(
      lessonId,
      embedding,
      TOP_K_EMBEDDINGS,
      neighbours,
    );

    return chunks.map((chunk) => ({
      id: "",
      role: MESSAGE_ROLE.SYSTEM as MessageRole,
      content: `[RAG] ${chunk.content}` as string,
    }));
  }

  private async getEmbedding(content: string) {
    const { embedding } = await embed({
      model: openai.textEmbeddingModel(OPENAI_MODELS.EMBEDDING),
      value: content,
    });

    return embedding;
  }
}
