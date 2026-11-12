import { LanguageModelV4 } from "@ai-sdk/provider";

import type {
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from "@ai-sdk/provider";

/**
 * Runs a call on the primary model and repeats it on the fallback when the primary call fails
 * before returning. A stream that fails after it started is not retried, because its output may
 * already be persisted; aborted calls are never retried.
 */
export class FallbackLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4";
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: LanguageModelV4["supportedUrls"];

  constructor(
    private readonly primary: LanguageModelV4,
    private readonly createFallback: () => Promise<LanguageModelV4>,
    private readonly onFallback: (error: unknown) => void,
  ) {
    this.provider = primary.provider;
    this.modelId = primary.modelId;
    this.supportedUrls = primary.supportedUrls;
  }

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    try {
      return await this.primary.doGenerate(options);
    } catch (error) {
      return (await this.fallbackAfter(error, options)).doGenerate(options);
    }
  }

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    try {
      return await this.primary.doStream(options);
    } catch (error) {
      return (await this.fallbackAfter(error, options)).doStream(options);
    }
  }

  private async fallbackAfter(error: unknown, options: LanguageModelV4CallOptions) {
    if (options.abortSignal?.aborted) throw error;
    this.onFallback(error);
    return this.createFallback();
  }
}
