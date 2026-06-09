import { Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class MinioStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly internalEndpoint: string;
  private readonly publicEndpoint: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT;
    const accessKeyId = process.env.MINIO_ACCESS_KEY;
    const secretAccessKey = process.env.MINIO_SECRET_KEY;
    this.bucket = process.env.MINIO_BUCKET ?? 'metamorph-artifacts';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY are required',
      );
    }

    this.internalEndpoint = endpoint.replace(/\/$/, '');
    this.publicEndpoint = (
      process.env.MINIO_PUBLIC_ENDPOINT ?? endpoint
    ).replace(/\/$/, '');

    this.client = new S3Client({
      endpoint,
      region: process.env.MINIO_REGION ?? 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async ping(): Promise<void> {
    await this.client.send(
      new HeadBucketCommand({ Bucket: this.bucket }),
    );
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getPresignedUrl(
    key: string,
    ttlSeconds = 900,
  ): Promise<{ url: string; expiresAt: Date }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const signUrl = getSignedUrl as unknown as (
      client: S3Client,
      command: GetObjectCommand,
      options: { expiresIn: number },
    ) => Promise<string>;
    let url = await signUrl(this.client, command, {
      expiresIn: ttlSeconds,
    });

    if (this.publicEndpoint !== this.internalEndpoint) {
      url = url.replace(this.internalEndpoint, this.publicEndpoint);
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { url, expiresAt };
  }
}
