import { Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    this.bucket = process.env.S3_BUCKET ?? 'metamorph-artifacts';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY are required',
      );
    }

    const options = {
      region: process.env.S3_REGION ?? 'garage',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    };
    this.client = new S3Client({ ...options, endpoint });
    // The host is part of the signature: sign the browser's endpoint directly.
    this.signingClient = new S3Client({
      ...options,
      endpoint: process.env.S3_PUBLIC_ENDPOINT ?? endpoint,
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
    const url = await signUrl(this.signingClient, command, {
      expiresIn: ttlSeconds,
    });

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    return { url, expiresAt };
  }
}
