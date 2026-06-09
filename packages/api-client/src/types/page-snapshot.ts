export type PageSnapshotDto = {
  id: string;
  url: string;
  labeledCount: number;
  createdAt: Date;
  annotatedScreenshotArtifactId?: string;
  rawScreenshotArtifactId?: string;
};
