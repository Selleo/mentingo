import { ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  ASSISTANT_OUTCOME_KINDS,
  ASSISTANT_RUN_ACTIVITIES,
  ASSISTANT_RUN_STATUSES,
  ASSISTANT_RUN_ERROR_CODES,
  TENANT_STATUSES,
  type AssistantRunActivity,
} from "@repo/shared";

import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";
import { McpHttpService } from "src/mcp/mcp-http.service";
import { isMcpNativeFeatureCapabilities } from "src/mcp/mcp-native-read.types";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  collectAssistantSources,
  groundAssistantText,
  selectAssistantSources,
  hasAssistantReadableContent,
} from "./assistant-links";
import { getAssistantReadActivity } from "./assistant-progress";
import { AssistantRepository } from "./assistant.repository";
import { validateAssistantOutcome } from "./workflow/assistant-outcome";

import type { AssistantRunIdentity, AssistantSource } from "./assistant.types";
import type { AssistantOutcome } from "./workflow/assistant-outcome.types";
import type { LanguageModelV4 } from "@ai-sdk/provider";

@Injectable()
export class AssistantExecutionService {
  constructor(
    private readonly assistantRepository: AssistantRepository,
    private readonly mcpHttpService: McpHttpService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly aiRuntimeService: AiRuntimeService,
  ) {}

  private async requireActive(input: AssistantRunIdentity) {
    const run = await this.assistantRepository.getRun(input);
    if (
      run.status !== ASSISTANT_RUN_STATUSES.PENDING &&
      run.status !== ASSISTANT_RUN_STATUSES.RUNNING
    )
      throw new ForbiddenException("assistant.errors.responseInactive");
    const tenant = await this.assistantRepository.findTenantState(input.tenantId);
    if (tenant?.status !== TENANT_STATUSES.ACTIVE) {
      // Background steps bypass HTTP tenant resolution. Suspension is terminal for this run,
      // so reactivation cannot resume a previously authorized generation or overwrite its result.
      await this.assistantRepository.updateRun(input, {
        status: ASSISTANT_RUN_STATUSES.FAILED,
        errorCode: tenant
          ? ASSISTANT_RUN_ERROR_CODES.TENANT_INACTIVE
          : ASSISTANT_RUN_ERROR_CODES.TENANT_NOT_FOUND,
      });
      throw new ForbiddenException("common.toast.noAccess");
    }
    const account = await this.assistantRepository.isAccountActive({
      tenantId: input.tenantId,
      userId: run.userId,
    });
    if (!account) throw new ForbiddenException("common.toast.noAccess");
    return run;
  }

  async loadContext(input: AssistantRunIdentity) {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      const run = await this.requireActive(input);
      await this.assistantRepository.updateRun(input, { status: ASSISTANT_RUN_STATUSES.RUNNING });
      // Resolve module availability before the model can classify a reply as conversation.
      // This metadata handshake is not evidence for factual content answers.
      const capabilityResult = await this.mcpHttpService.executeNativeReadTool(
        run.userId,
        input.tenantId,
        run.origin,
        "get_my_capabilities",
        {},
      );
      const capabilityPayload = capabilityResult.structuredContent;
      const capabilities =
        capabilityPayload && typeof capabilityPayload === "object"
          ? Reflect.get(capabilityPayload, "features")
          : undefined;
      if (capabilityResult.isError || !isMcpNativeFeatureCapabilities(capabilities))
        throw new ServiceUnavailableException("assistant.errors.unavailable");
      const [history, tools] = await Promise.all([
        this.assistantRepository.getHistory(input),
        this.mcpHttpService.listNativeReadTools(run.userId, input.tenantId, run.origin),
      ]);
      return {
        run,
        sources: run.sources,
        capabilities,
        messages: history.map((message) => ({ role: message.role, content: message.text })),
        tools,
      };
    });
  }

  async getModel(input: AssistantRunIdentity): Promise<LanguageModelV4> {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      await this.requireActive(input);
      await this.assistantRepository.updateRun(input, {
        activity: ASSISTANT_RUN_ACTIVITIES.THINKING,
      });
      const openai = await this.aiRuntimeService.getAISdkOpenAI();
      return openai(OPENAI_MODELS.BASIC);
    });
  }

  async executeTool(input: AssistantRunIdentity, name: string, args: Record<string, unknown>) {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      const run = await this.requireActive(input);
      const result = await this.mcpHttpService.executeNativeReadTool(
        run.userId,
        input.tenantId,
        run.origin,
        name,
        args,
        async () => {
          const activity = getAssistantReadActivity(name);
          if (activity) await this.setActivity(input, activity);
        },
      );
      if (!result.isError) {
        const sources = collectAssistantSources(result.structuredContent, run.origin, name);
        const latest = await this.assistantRepository.getRun(input);
        const all = [
          ...new Map(
            [...latest.sources, ...sources].map((source) => [source.url, source]),
          ).values(),
        ].slice(0, 100);
        await this.assistantRepository.updateRun(input, {
          sources: all,
          recordTool: { readable: hasAssistantReadableContent(name, result.structuredContent) },
        });
      }
      return result;
    });
  }

  async setActivity(input: AssistantRunIdentity, activity: AssistantRunActivity): Promise<void> {
    await this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      await this.requireActive(input);
      await this.assistantRepository.updateRun(input, { activity });
    });
  }

  async validateOutcome(input: AssistantRunIdentity, outcome: AssistantOutcome) {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      const run = await this.requireActive(input);
      return validateAssistantOutcome(outcome, run);
    });
  }

  async checkpoint(
    input: AssistantRunIdentity,
    text: string,
    _sources?: AssistantSource[],
    kind: AssistantOutcome["kind"] = ASSISTANT_OUTCOME_KINDS.ANSWER,
    requiresReadableContent = false,
  ) {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      const run = await this.requireActive(input);
      if (!validateAssistantOutcome({ kind, text, requiresReadableContent }, run).accepted) return;
      const grounded = groundAssistantText(text, run.sources);
      await this.assistantRepository.updateRun(input, {
        status: ASSISTANT_RUN_STATUSES.RUNNING,
        text: grounded,
        messageSources: selectAssistantSources(grounded, run.sources),
      });
    });
  }

  async complete(
    input: AssistantRunIdentity,
    text: string,
    _sources?: AssistantSource[],
    kind: AssistantOutcome["kind"] = ASSISTANT_OUTCOME_KINDS.ANSWER,
    requiresReadableContent = false,
  ) {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      const run = await this.requireActive(input);
      const validation = validateAssistantOutcome({ kind, text, requiresReadableContent }, run);
      if (!validation.accepted) return validation;
      const grounded = groundAssistantText(text, run.sources);
      await this.assistantRepository.updateRun(input, {
        status: ASSISTANT_RUN_STATUSES.COMPLETED,
        text: grounded,
        messageSources: selectAssistantSources(grounded, run.sources),
      });
      return validation;
    });
  }

  async fail(input: AssistantRunIdentity, errorCode: string) {
    await this.tenantDbRunnerService.runWithTenant(input.tenantId, () =>
      this.assistantRepository.updateRun(input, {
        status: ASSISTANT_RUN_STATUSES.FAILED,
        errorCode: /^[A-Z_]{1,80}$/.test(errorCode)
          ? errorCode
          : ASSISTANT_RUN_ERROR_CODES.GENERATION_FAILED,
      }),
    );
  }
}
