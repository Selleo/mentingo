import { Injectable } from "@nestjs/common";
import { encoding_for_model, get_encoding } from "tiktoken";

import { OPENAI_MODELS } from "src/ai/utils/ai.type";

import type { OpenAIModels } from "src/ai/utils/ai.type";
import type { TiktokenModel } from "tiktoken";

@Injectable()
export class TokenService {
  getEncoder(encoderType: OpenAIModels) {
    if (encoderType === OPENAI_MODELS.TRANSCRIBE) {
      // whisper-1 is not part of TiktokenModel.
      return get_encoding("cl100k_base");
    }

    try {
      return encoding_for_model(encoderType as TiktokenModel);
    } catch {
      return get_encoding("cl100k_base");
    }
  }

  countTokens(model: OpenAIModels, text: string): number {
    try {
      const tokens = this.getEncoder(model).encode(text);

      return tokens.length;
    } catch (error) {
      return Math.ceil(text.length / 4);
    }
  }
}
