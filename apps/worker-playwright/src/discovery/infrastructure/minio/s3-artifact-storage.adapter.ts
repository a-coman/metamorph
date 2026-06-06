import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ArtifactStoragePort } from '../../domain/repositories/artifact-storage.port.js';

export class S3ArtifactStorageAdapter extends ArtifactStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    super();

    const endpoint = process.env.MINIO_ENDPOINT;
    const accessKeyId = process.env.MINIO_ACCESS_KEY;
    const secretAccessKey = process.env.MINIO_SECRET_KEY;
    this.bucket = process.env.MINIO_BUCKET ?? 'metamorph-artifacts';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY are required',
      );
    }

    this.client = new S3Client({
      endpoint,
      region: process.env.MINIO_REGION ?? 'us-east-1',
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
