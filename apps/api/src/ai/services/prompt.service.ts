import { LangfuseClient } from "@langfuse/client";
import { observe } from "@langfuse/tracing";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PROMPT_MAP, promptTemplates } from "@repo/prompts";
import { Value } from "@sinclair/typebox/value";
import { eq } from "drizzle-orm";
import Handlebars from "handlebars";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { MessageService } from "src/ai/services/message.service";
import { RagService } from "src/ai/services/rag.service";
import { TokenService } from "src/ai/services/token.service";
import { MESSAGE_ROLE, OPENAI_MODELS } from "src/ai/utils/ai.type";
import { aiMentorThreads } from "src/storage/schema";

import type { OnModuleInit } from "@nestjs/common";
import type { promptId } from "@repo/prompts";
import type { Static, TSchema } from "@sinclair/typebox";
import type { ThreadOwnershipBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";

type CompiledTemplate = {
  id: promptId;
  template: Handlebars.TemplateDelegate;
  varsSchema?: TSchema;
};

@Injectable()
export class PromptService implements OnModuleInit {
  private prompts = new Map<promptId, CompiledTemplate>();
  private langfuseClient: LangfuseClient;
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly messageService: MessageService,
    private readonly tokenService: TokenService,
    private readonly ragService: RagService,
  ) {}

  onModuleInit() {
    Object.entries(promptTemplates).forEach(([id, template]) => {
      const compiled = Handlebars.compile(template.template);

      this.prompts.set(id as promptId, {
        id: id as promptId,
        template: compiled,
        varsSchema: PROMPT_MAP[id as keyof typeof PROMPT_MAP],
      });

      if (
        !(
          process.env.LANGFUSE_PUBLIC_KEY &&
          process.env.LANGFUSE_SECRET_KEY &&
          process.env.LANGFUSE_HOST
        )
      )
        return;

      this.langfuseClient = new LangfuseClient({
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        baseUrl: process.env.LANGFUSE_HOST,
      });
    });
  }

  async buildPrompt(threadId: UUIDType, content: string, tempMessageId?: string) {
    const { history } = await this.messageService.findMessageHistory(threadId, false);

    const systemPrompt = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SYSTEM,
    );

    const summary = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SUMMARY,
    );

    if (summary)
      history.unshift({
        id: summary.id,
        role: summary.role,
        userName: null,
        content: summary.content,
      });

    if (systemPrompt)
      history.unshift({
        id: systemPrompt.id,
        role: systemPrompt.role,
        userName: null,
        content: systemPrompt.content,
      });

    const { lessonId } = await this.aiRepository.findLessonIdByThreadId(threadId);
    const contextInfo = content + history[history.length - 1]?.content ?? "";

    const { chunks: context } = await observe(
      async () => {
        return this.ragService.getContext(contextInfo, lessonId);
      },
      { name: "RAG", asType: "retriever" },
    )();

    history.push({ id: tempMessageId ?? "", role: MESSAGE_ROLE.USER, userName: null, content });
    history.push(
      ...context.map(({ role, content }) => ({ id: "", role, userName: null, content })),
    );

    return history;
  }

  async setSystemPrompt(data: ThreadOwnershipBody) {
    const { userLanguage } = await this.aiRepository.findThread([
      eq(aiMentorThreads.id, data.threadId),
    ]);

    const lesson = await this.aiRepository.findMentorLessonByThreadId(data.threadId);

    const groups = await this.aiRepository.findGroupsByThreadId(data.threadId);

    const mode = (lesson.type ?? "mentor").toLowerCase();

    const securityAndRagBlock = await this.loadPrompt("securityAndRagBlock", {
      language: userLanguage,
    });

    let promptChoice;

    switch (mode) {
      case "teacher":
        promptChoice = promptTemplates.teacherPrompt.id;
        break;
      case "roleplay":
        promptChoice = promptTemplates.roleplayPrompt.id;
        break;
      case "mentor":
      default:
        promptChoice = promptTemplates.mentorPrompt.id;
    }

    const prompt = await this.loadPrompt(promptChoice, {
      lessonTitle: lesson.title,
      lessonInstructions: lesson.instructions,
      groups: groups,
      securityAndRagBlock: securityAndRagBlock,
    });

    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, prompt);

    await this.aiRepository.insertMessage({
      tokenCount,
      threadId: data.threadId,
      role: MESSAGE_ROLE.SYSTEM,
      content: prompt,
    });

    return prompt;
  }

  async loadPrompt<K extends keyof typeof PROMPT_MAP>(id: K, vars: Static<(typeof PROMPT_MAP)[K]>) {
    const langfusePrompt = await this.langfuseClient?.prompt?.get(id).catch(() => undefined);

    if (langfusePrompt?.prompt) {
      return Handlebars.compile(langfusePrompt.prompt)(vars);
    }

    const prompt = this.prompts.get(id);
    if (!prompt) {
      throw new Error(`Prompt ${id} not found`);
    }

    if (prompt.varsSchema && !Value.Check(prompt.varsSchema, vars)) {
      throw new Error("Prompt template failed validation");
    }

    return prompt.template(vars);
  }

  async isNotEmpty(prompt: string) {
    if (!prompt?.trim()) {
      throw new BadRequestException("At least one message required");
    }
  }

  async getOpenAI() {
    return this.ragService.getOpenAI();
  }
}
