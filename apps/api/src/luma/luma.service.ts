import { createLumaClient } from "@mentingo/luma-sdk";
import { BadRequestException, Injectable } from "@nestjs/common";

import { EnvService } from "src/env/services/env.service";

@Injectable()
export class LumaService {
  constructor(private readonly envService: EnvService) {}

  async getLumaClient() {
    const apiKey = await this.envService
      .getEnv("LUMA_API_KEY")
      .then((r) => r.value)
      .catch(() => process.env.LUMA_API_KEY);
    const baseURL = process.env.LUMA_BASE_URL;

    if (!baseURL || !apiKey) {
      throw new BadRequestException("adminCourseView.toast.lumaNotConfigured");
    }

    return createLumaClient({
      apiKey,
      baseURL,
    });
  }
}
