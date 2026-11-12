import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ArtifactStoragePort } from '../../domain/repositories/artifact-storage.port.js';

export class S3ArtifactStorageAdapter extends ArtifactStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    super();

    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    this.bucket = process.env.S3_BUCKET ?? 'metamorph-artifacts';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY are required',
      );
    }

    this.client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'garage',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
