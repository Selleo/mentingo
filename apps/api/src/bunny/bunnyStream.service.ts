import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

import type { AxiosInstance } from "axios";

@Injectable()
export class BunnyStreamService {
  private readonly apiKey: string;
  private readonly signingKey: string;
  private readonly libraryId: string;
  private readonly cdnUrl: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("BUNNY_STREAM_API_KEY") || "";
    this.signingKey = this.configService.get<string>("BUNNY_STREAM_SIGNING_KEY") || "";
    this.libraryId = this.configService.get<string>("BUNNY_STREAM_LIBRARY_ID") || "";
    this.cdnUrl = this.configService.get<string>("BUNNY_STREAM_CDN_URL") || "";

    this.httpClient = axios.create({
      baseURL: `https://video.bunnycdn.com/library/${this.libraryId}`,
      headers: {
        AccessKey: this.apiKey,
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
      const { data: video } = await this.httpClient.post("/videos", {
        title: file.originalname,
      });

      await this.httpClient.put(`/videos/${video.guid}`, file.buffer, {
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
      await this.httpClient.delete(`/videos/${videoId}`);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  }

  async getUrl(videoId: string): Promise<string> {
    const baseUrl = `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}`;
    return baseUrl;
  }
}
