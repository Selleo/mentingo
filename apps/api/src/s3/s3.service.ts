import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Readable } from "stream";

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const config = this.loadS3Config();

    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });

    this.bucketName = config.bucketName;

    if (!this.s3Client) {
      throw new Error("S3 client is not initialized. Please check your configuration.");
    }
  }

  private loadS3Config() {
    const s3Config = this.getS3Config("s3.S3");
    if (this.isValidS3Config(s3Config)) {
      return s3Config;
    }

    const awsConfig = this.getS3Config("aws.AWS");
    return awsConfig;
  }

  private getS3Config(prefix: string) {
    return {
      endpoint: this.configService.get<string>(`${prefix}_ENDPOINT`) || "",
      region: this.configService.get<string>(`${prefix}_REGION`) || "us-east-1",
      accessKeyId: this.configService.get<string>(`${prefix}_ACCESS_KEY_ID`) || "",
      secretAccessKey: this.configService.get<string>(`${prefix}_SECRET_ACCESS_KEY`) || "",
      bucketName: this.configService.get<string>(`${prefix}_BUCKET_NAME`) || "",
    };
  }

  private isValidS3Config(config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  }): boolean {
    return !!(
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.bucketName &&
      config.endpoint
    );
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getFileContent(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return response.Body?.transformToString() || "";
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes || []);
  }

  async uploadFile(fileBuffer: Buffer, key: string, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async getFileStream(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }
}
