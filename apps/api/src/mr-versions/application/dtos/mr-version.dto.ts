export type MrVersionDetailsDto = {
  id: string;
  status: string;
  generationSlots: unknown;
  mrDefinition: unknown;
  pageSnapshotId: string | null;
  locatorValidationScore: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MrVersionPlaybookDto = {
  id: string;
  content: string;
  contentHash: string;
  templateVersion: string;
};

export type SessionMrVersionSummaryDto = {
  id: string;
  status: string;
  transformFamily: string;
};
