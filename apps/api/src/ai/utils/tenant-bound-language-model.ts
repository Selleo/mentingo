/** Re-enter trusted tenant context when a deferred assistant model is actually invoked. */
import { LanguageModelV4 } from "@ai-sdk/provider";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import type {
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from "@ai-sdk/provider";

/** Capture only tenant identity and model, never a database transaction or an ALS snapshot. */
export class TenantBoundLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4";
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: LanguageModelV4["supportedUrls"];

  /** Bind the existing runner to the authorized identity without retaining any DB handle. */
  constructor(
    private readonly model: LanguageModelV4,
    private readonly tenantId: string,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {
    this.provider = model.provider;
    this.modelId = model.modelId;
    this.supportedUrls = model.supportedUrls;
  }

  /** Delayed native or fallback credential lookups use this authorized model step's tenant. */
  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    return this.tenantDbRunnerService.runWithTenant(this.tenantId, () =>
      this.model.doGenerate(options),
    );
  }

  /** The runner establishes context only; it does not hold an open transaction across I/O. */
  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    return this.tenantDbRunnerService.runWithTenant(this.tenantId, () =>
      this.model.doStream(options),
    );
  }
}
