import * as crypto from "crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";

@Injectable()
export class BunnyStreamService {
  private readonly apiKey: string;
  private readonly signingKey: string;
  private readonly libraryId: string;
  private readonly cdnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("BUNNY_STREAM_API_KEY") || "";
    this.signingKey = this.configService.get<string>("BUNNY_STREAM_SIGNING_KEY") || "";
    this.libraryId = this.configService.get<string>("BUNNY_STREAM_LIBRARY_ID") || "";
    this.cdnUrl = this.configService.get<string>("BUNNY_STREAM_CDN_URL") || "";
  }

  async upload(file: Express.Multer.File): Promise<{
    fileKey: string;
    fileUrl: string;
    thumbnailUrl: string;
    directPlayUrl: string;
  }> {
    try {
      const createRes = await axios.post(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos`,
        { title: file.originalname },
        {
          headers: {
            AccessKey: this.apiKey,
            "Content-Type": "application/json",
          },
        },
      );

      const videoId = createRes.data.guid;

      await axios.put(
        `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoId}`,
        file.buffer,
        {
          headers: {
            AccessKey: this.apiKey,
            "Content-Type": "application/octet-stream",
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000,
        },
      );

      return {
        fileKey: `bunny-${videoId}`,
        fileUrl: `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}`,
        thumbnailUrl: `${this.cdnUrl}/${videoId}/thumbnail.jpg`,
        directPlayUrl: `${this.cdnUrl}/${videoId}/play_480p.mp4`,
      };
    } catch (error) {
      // this.logger.error(`Bunny upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async delete(videoId: string): Promise<{ success: boolean }> {
    const res = await axios.delete(
      `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoId}`,
      {
        headers: {
          AccessKey: this.apiKey,
        },
      },
    );
    return { success: res.status === 200 };
  }

  async getSignedUrl(videoId: string, ttlSeconds: number): Promise<string> {
    const baseUrl = `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}`;
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;

    const raw = `${this.signingKey}${videoId}${expires}`;
    const token = crypto.createHash("sha256").update(raw).digest("hex");

    return `${baseUrl}?token=${token}&expires=${expires}`;
  }
}
