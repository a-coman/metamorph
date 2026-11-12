import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

export class S3ArtifactReaderAdapter {
  private readonly client: S3Client;
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

    this.client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'garage',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Empty artifact body for key ${key}`);
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
}
