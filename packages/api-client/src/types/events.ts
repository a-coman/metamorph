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
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  createdAt: Date;
};

export type SessionLlmCallEvent = {
  type: 'llm.call';
  llmCall: LlmCallDto;
};

export type ProbeStatusDto = {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  phase: string | null;
  stepCount: number | null;
  error: string | null;
  snapshotId: string | null;
  updatedAt: Date;
};

export type SessionProbeStatusEvent = {
  type: 'probe.status';
  probe: ProbeStatusDto;
};

export type ScreenshotDto = {
  id: string;
  snapshotId: string;
  artifactId: string;
  url: string | null;
  createdAt: Date;
};

export type SessionScreenshotEvent = {
  type: 'screenshot.captured';
  screenshot: ScreenshotDto;
};

export type SessionEvent =
  | SessionJobUpdatedEvent
  | SessionMrCreatedEvent
  | SessionMrStatusChangedEvent
  | SessionLlmCallEvent
  | SessionProbeStatusEvent
  | SessionScreenshotEvent;

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
