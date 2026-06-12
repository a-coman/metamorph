import type { SessionJobSummaryDto, SessionMrVersionSummaryDto } from './session.js';
import type { ExplorationCheckpointDto } from './mr-version.js';
import type { RunSummaryDto } from './run.js';

export type SessionJobUpdatedEvent = {
  type: 'job.updated';
  job: SessionJobSummaryDto;
};

export type SessionMrCreatedEvent = {
  type: 'mr.created';
  mr: SessionMrVersionSummaryDto;
};

export type SessionMrStatusChangedEvent = {
  type: 'mr.status_changed';
  mrVersionId: string;
  status: string;
};

export type LlmCallDto = {
  id: string;
  purpose: string;
  model: string;
  promptVersion: string;
  status: 'running' | 'done' | 'failed';
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  responseJson: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};

/** @deprecated Use llm.status — kept for replay compatibility */
export type SessionLlmCallEvent = {
  type: 'llm.call';
  llmCall: LlmCallDto;
};

export type SessionLlmStatusEvent = {
  type: 'llm.status';
  llmCall: LlmCallDto;
};

export type ProbeJobMode = 'incremental' | 'smoke_replay';

export type ProbeStatusDto = {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  mode: ProbeJobMode;
  phase: string | null;
  stepCount: number | null;
  executedSteps: unknown[] | null;
  error: string | null;
  /** @deprecated Use outputSnapshotId */
  snapshotId: string | null;
  outputSnapshotId: string | null;
  updatedAt: Date;
};

export type SessionProbeStatusEvent = {
  type: 'probe.status';
  probe: ProbeStatusDto;
};

export type ScreenshotDto = {
  id: string;
  snapshotId: string;
  jobId: string | null;
  artifactId: string;
  url: string | null;
  createdAt: Date;
};

export type SessionScreenshotEvent = {
  type: 'screenshot.captured';
  screenshot: ScreenshotDto;
};

export type SessionStreamEndEvent = {
  type: 'stream.end';
};

export type SessionEvent =
  | SessionJobUpdatedEvent
  | SessionMrCreatedEvent
  | SessionMrStatusChangedEvent
  | SessionLlmCallEvent
  | SessionLlmStatusEvent
  | SessionProbeStatusEvent
  | SessionScreenshotEvent
  | SessionStreamEndEvent;

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

export type MrStreamEndEvent = {
  type: 'stream.end';
};

export type MrVersionEvent =
  | MrCheckpointCreatedEvent
  | MrStatusChangedEvent
  | MrRunUpdatedEvent
  | MrStreamEndEvent;
