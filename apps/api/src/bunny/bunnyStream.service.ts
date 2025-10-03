import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

import { EnvService } from "src/env/services/env.service";

import type { AxiosInstance } from "axios";

type BunnyConfig = {
  apiKey: string;
  signingKey: string | null;
  libraryId: string;
  cdnUrl: string | null;
};

@Injectable()
export class BunnyStreamService {
  private cache?: { cfg: BunnyConfig; expiresAt: number };

  constructor(
    private readonly configService: ConfigService,
    private readonly envService: EnvService,
  ) {}

  private async getConfig(): Promise<BunnyConfig> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.cfg;
    }

    const [apiKey, signingKey, libraryId, cdnUrl] = await Promise.all([
      this.envService
        .getEnv("BUNNY_STREAM_API_KEY")
        .then((r) => r.value)
        .catch(() => this.configService.get("BUNNY_STREAM_API_KEY")),

      this.envService
        .getEnv("BUNNY_STREAM_SIGNING_KEY")
        .then((r) => r.value)
        .catch(() => this.configService.get("BUNNY_STREAM_SIGNING_KEY")),

      this.envService
        .getEnv("BUNNY_STREAM_LIBRARY_ID")
        .then((r) => r.value)
        .catch(() => this.configService.get("BUNNY_STREAM_LIBRARY_ID")),

      this.envService
        .getEnv("BUNNY_STREAM_CDN_URL")
        .then((r) => r.value)
        .catch(() => this.configService.get("BUNNY_STREAM_CDN_URL")),
    ]);

    if (!apiKey || !libraryId) {
      throw new InternalServerErrorException(
        "BunnyStream configuration is missing. Please set API key and library ID.",
      );
    }

    const cfg: BunnyConfig = {
      apiKey,
      signingKey,
      libraryId,
      cdnUrl,
    };

    this.cache = { cfg, expiresAt: now + 60000 };
    return cfg;
  }

  private createHttpClient(cfg: BunnyConfig): AxiosInstance {
    return axios.create({
      baseURL: `https://video.bunnycdn.com/library/${cfg.libraryId}`,
      headers: {
        AccessKey: cfg.apiKey,
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  }

  async upload(file: Express.Multer.File): Promise<{
    fileKey: string;
    fileUrl: string;
  }> {
    try {
      const cfg = await this.getConfig();
      const httpClient = this.createHttpClient(cfg);

      const { data: video } = await httpClient.post("/videos", {
        title: file.originalname,
      });

      await httpClient.put(`/videos/${video.guid}`, file.buffer, {
        headers: { "Content-Type": "application/octet-stream" },
      });

      return {
        fileKey: `bunny-${video.guid}`,
        fileUrl: await this.getUrl(video.guid),
      };
    } catch (error) {
      throw error;
    }
  }

  async delete(videoId: string): Promise<{ success: boolean }> {
    try {
      const cfg = await this.getConfig();
      const httpClient = this.createHttpClient(cfg);

      await httpClient.delete(`/videos/${videoId}`);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  }

  async getUrl(videoId: string): Promise<string> {
    const cfg = await this.getConfig();
    const baseUrl = `https://iframe.mediadelivery.net/embed/${cfg.libraryId}/${videoId}`;
    return baseUrl;
  }
}
