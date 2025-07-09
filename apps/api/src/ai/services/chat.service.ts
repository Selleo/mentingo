import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { generateText, type Message } from "ai";

import type { MessageRole, OpenAIModels } from "src/ai/ai.type";

@Injectable()
export class ChatService {
  async generatePrompt(prompt: string, model: OpenAIModels): Promise<string> {
    if (!prompt?.trim()) {
      throw new Error("Prompt cannot be empty");
    }

    try {
      const { text } = await generateText({
        model: openai(model),
        prompt: prompt,
      });
      return text;
    } catch (error) {
      throw new Error(
        `Failed to generate message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async chat(
    messages: Array<{ role: MessageRole; content: string }>,
    model: OpenAIModels,
  ): Promise<string> {
    if (!messages?.length) {
      throw new Error("Messages array cannot be empty");
    }

    try {
      const { text } = await generateText({
        model: openai(model),
        messages: messages.map((m) => ({
          ...m,
          role: m.role === "summary" ? ("system" as const) : m.role,
        })) as Omit<Message, "id">[],
      });
      return text;
    } catch (error) {
      throw new Error(
        `Failed to generate chat message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }
}
