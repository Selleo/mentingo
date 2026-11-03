import { Module } from "@nestjs/common";

import { RagRepository } from "src/ai/repositories/rag.repository";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { RagService } from "src/ai/services/rag.service";

/**
 * The AI provider runtime and document retrieval, without the rest of AiModule. Modules that only
 * need embeddings, such as the native-archive queue sandbox, import this and share its instances.
 */
@Module({
  providers: [AiRuntimeService, RagRepository, RagService],
  exports: [AiRuntimeService, RagService],
})
export class AiRuntimeModule {}
