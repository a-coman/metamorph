import type { SlotStep } from '@metamorph/core';
import { JobStatus } from '../enums/job-status.enum.js';
import { JobType } from '../enums/job-type.enum.js';

export type ProbeJobMode = 'incremental' | 'smoke_replay';

export type ProbeJobPayload = {
  exploreJobId: string;
  mrVersionId: string;
  phase: 'source' | 'follow_up';
  inventorySnapshotId: string;
  mode: ProbeJobMode;
  validatedPrefix: SlotStep[];
  probeSteps: SlotStep[];
  resumeUrl: string;
};

export type ProbeJobProps = {
  sessionId: string;
  sessionUrl: string;
  payload: ProbeJobPayload;
  type: JobType;
  status: JobStatus;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export class ProbeJob {
  readonly id: string;

  private props: ProbeJobProps;

  private constructor(id: string, props: ProbeJobProps) {
    this.id = id;
    this.props = props;
  }

  static reconstitute(id: string, props: ProbeJobProps): ProbeJob {
    return new ProbeJob(id, props);
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get sessionUrl(): string {
    return this.props.sessionUrl;
  }

  get payload(): ProbeJobPayload {
    return this.props.payload;
  }

  get type() {
    return this.props.type;
  }

  get status() {
    return this.props.status;
  }

  get errorMessage(): string | null | undefined {
    return this.props.errorMessage;
  }

  get startedAt(): Date | null | undefined {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null | undefined {
    return this.props.finishedAt;
  }

  start(): { ok: true } | { ok: false; reason: string } {
    if (this.props.type !== JobType.probe) {
      return { ok: false, reason: `type=${this.props.type}` };
    }

    if (this.props.status !== JobStatus.queued) {
      return { ok: false, reason: `status=${this.props.status}` };
    }

    this.props.status = JobStatus.running;
    this.props.startedAt = new Date();
    this.props.errorMessage = null;
    return { ok: true };
  }

  complete(): void {
    this.props.status = JobStatus.done;
    this.props.finishedAt = new Date();
  }

  fail(message: string): void {
    this.props.status = JobStatus.failed;
    this.props.finishedAt = new Date();
    this.props.errorMessage = message;
  }
}
