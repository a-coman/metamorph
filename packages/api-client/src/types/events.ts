import type { SessionJobSummaryDto } from './session.js';
import type { ExplorationCheckpointDto } from './mr-version.js';
import type { RunSummaryDto } from './run.js';

export type SessionJobUpdatedEvent = {
  type: 'job.updated';
  job: SessionJobSummaryDto;
};

export type SessionMrStatusChangedEvent = {
  type: 'mr.status_changed';
  mrVersionId: string;
  status: string;
};

export type SessionEvent =
  | SessionJobUpdatedEvent
  | SessionMrStatusChangedEvent;

export type MrCheckpointCreatedEvent = {
  type: 'checkpoint.created';
  checkpoint: ExplorationCheckpointDto;
};

export type MrStatusChangedEvent = {
  type: 'status.changed';
  status: string;
};

export type MrRunUpdatedEvent = {
  type: 'run.updated';
  run: RunSummaryDto;
};

export type MrVersionEvent =
  | MrCheckpointCreatedEvent
  | MrStatusChangedEvent
  | MrRunUpdatedEvent;
