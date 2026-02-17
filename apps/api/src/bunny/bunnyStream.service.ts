import { createHash } from "crypto";

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

import { BUNNY_CDN_TOKEN_EXPIRY } from "src/bunny/bunnyStream.constants";
import { EnvService } from "src/env/services/env.service";

import type { AxiosInstance } from "axios";

type BunnyConfig = {
  apiKey: string;
  signingKey: string | null;
  libraryId: string;
  cdnUrl: string | null;
  tokenSigningKey: string;
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

    const [apiKey, signingKey, libraryId, cdnUrl, tokenSigningKey] = await Promise.all([
      this.envService
        .getEnv("BUNNY_STREAM_API_KEY")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_API_KEY")),

      this.envService
        .getEnv("BUNNY_STREAM_SIGNING_KEY")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_SIGNING_KEY")),

      this.envService
        .getEnv("BUNNY_STREAM_LIBRARY_ID")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_LIBRARY_ID")),

      this.envService
        .getEnv("BUNNY_STREAM_CDN_URL")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_CDN_URL")),

      this.envService
        .getEnv("BUNNY_STREAM_TOKEN_SIGNING_KEY")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_TOKEN_SIGNING_KEY")),
    ]);

    if (!apiKey) {
      throw new InternalServerErrorException(
        "BunnyStream configuration is missing API key (BUNNY_STREAM_API_KEY).",
      );
    }

    if (!libraryId) {
      throw new InternalServerErrorException(
        "BunnyStream configuration is missing library ID (BUNNY_STREAM_LIBRARY_ID).",
      );
    }

    if (!tokenSigningKey) {
      throw new InternalServerErrorException(
        "BunnyStream configuration is missing token signing key (BUNNY_STREAM_TOKEN_SIGNING_KEY).",
      );
    }

    if (!cdnUrl) {
      throw new InternalServerErrorException(
        "BunnyStream configuration is missing CDN URL (BUNNY_STREAM_CDN_URL).",
      );
    }

    const cfg: BunnyConfig = {
      apiKey,
      signingKey,
      libraryId,
      tokenSigningKey,
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

  async isConfigured(): Promise<boolean> {
    const [apiKey, libraryId, cdnUrl, tokenSigningKey] = await Promise.all([
      this.envService
        .getEnv("BUNNY_STREAM_API_KEY")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_API_KEY")),
      this.envService
        .getEnv("BUNNY_STREAM_LIBRARY_ID")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_LIBRARY_ID")),
      this.envService
        .getEnv("BUNNY_STREAM_CDN_URL")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_CDN_URL")),
      this.envService
        .getEnv("BUNNY_STREAM_TOKEN_SIGNING_KEY")
        .then((r) => r.value)
        .catch(() => this.configService.get("bunny.BUNNY_STREAM_TOKEN_SIGNING_KEY")),
    ]);

    return Boolean(apiKey && libraryId && cdnUrl && tokenSigningKey);
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

  async createVideo(title: string): Promise<{ guid: string }> {
    const cfg = await this.getConfig();
    const httpClient = this.createHttpClient(cfg);

    const { data } = await httpClient.post("/videos", {
      title,
    });

    return { guid: data.guid };
  }

  async getTusUploadConfig(videoId: string): Promise<{
    tusEndpoint: string;
    tusHeaders: Record<string, string>;
    expiresAt: string;
  }> {
    const cfg = await this.getConfig();

    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const signature = createHash("sha256")
      .update(`${cfg.libraryId}${cfg.apiKey}${expiresAt}${videoId}`)
      .digest("hex");

    return {
      tusEndpoint: "https://video.bunnycdn.com/tusupload",
      tusHeaders: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expiresAt),
        VideoId: videoId,
        LibraryId: cfg.libraryId,
      },
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
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

    const httpClient = this.createHttpClient(cfg);

    const { data } = await httpClient.get(`/videos/${videoId}/play`);
    const expiresAt = Math.floor(Date.now() / 1000) + BUNNY_CDN_TOKEN_EXPIRY;

    return this.signBunnyUrl(data.videoPlaylistUrl, expiresAt, cfg.tokenSigningKey, {
      pathAllowed: this.getTokenPath(new URL(data.videoPlaylistUrl).pathname),
      outputFormat: "path",
    });
  }

  async getThumbnailUrl(videoId: string): Promise<string> {
    const cfg = await this.getConfig();

    const url = `https://${cfg.cdnUrl}/${videoId}/thumbnail.jpg`;
    const expiresAt = Math.floor(Date.now() / 1000) + BUNNY_CDN_TOKEN_EXPIRY;

    return this.signBunnyUrl(url, expiresAt, cfg.tokenSigningKey);
  }

  async signBunnyUrl(
    url: string,
    expires: number,
    securityKey: string,
    options?: { pathAllowed?: string; userIp?: string; outputFormat?: "query" | "path" },
  ) {
    const signUrl = new URL(url);
    const parameters = new URLSearchParams(signUrl.search);
    const signaturePath = options?.pathAllowed ?? decodeURIComponent(signUrl.pathname);
    const userIp = options?.userIp ?? "";

    if (options?.pathAllowed) {
      parameters.set("token_path", options.pathAllowed);
    }

    const sortedParams = Array.from(parameters.entries())
      .filter(([key]) => key !== "token" && key !== "expires")
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [key, value], idx, _) => acc + (idx ? "&" : "") + `${key}=${value}`, "");

    const base = securityKey + signaturePath + String(expires) + userIp + sortedParams;

    const token = createHash("sha256")
      .update(base)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    parameters.set("token", token);
    parameters.set("expires", String(expires));

    if (options?.outputFormat === "path") {
      const tokenPart = new URLSearchParams();
      tokenPart.set("bcdn_token", token);
      tokenPart.set("expires", String(expires));

      const tokenPath = parameters.get("token_path");
      if (tokenPath) {
        tokenPart.set("token_path", tokenPath);
      }

      const passthroughParams = new URLSearchParams(parameters);
      passthroughParams.delete("token");
      passthroughParams.delete("expires");
      passthroughParams.delete("token_path");

      const passthroughQuery = passthroughParams.toString();
      const signedPathUrl = `${signUrl.origin}/${tokenPart.toString()}${signUrl.pathname}`;
      return passthroughQuery ? `${signedPathUrl}?${passthroughQuery}` : signedPathUrl;
    }

    const query = parameters.toString();
    return `${signUrl.origin}${signUrl.pathname}${query ? `?${query}` : ""}`;
  }

  private getTokenPath(pathname: string): string {
    const lastSlashIndex = pathname.lastIndexOf("/");
    return lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) : "/";
  }
}
