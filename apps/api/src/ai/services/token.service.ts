import { Injectable } from "@nestjs/common";
import { encoding_for_model } from "tiktoken";

import type { OpenAIModels } from "src/ai/ai.type";

@Injectable()
export class TokenService {
  getEncoder(encoderType: OpenAIModels) {
    return encoding_for_model(encoderType);
  }

  countTokens(model: OpenAIModels, text: string): number {
    try {
      const tokens = this.getEncoder(model).encode(text);
      return tokens.length;
    } catch (error) {
      return Math.ceil(text.length / 4);
    }
  }

  sumTokens(model: OpenAIModels, messages: Array<string>): number {
    return messages.reduce((total: number, msg) => {
      return total + this.countTokens(model, msg);
    }, 0);
  }
}
