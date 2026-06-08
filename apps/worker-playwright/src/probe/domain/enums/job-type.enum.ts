export enum JobType {
  probe = 'probe',
}

export enum JobStatus {
  pending_enqueue = 'pending_enqueue',
  queued = 'queued',
  running = 'running',
  done = 'done',
  failed = 'failed',
  enqueue_failed = 'enqueue_failed',
}
