export abstract class ArtifactStoragePort {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
}
