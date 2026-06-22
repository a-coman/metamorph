export const SESSION_CONTROL_STATUSES = ['active', 'pausing', 'paused'] as const;

export type SessionControlStatus = (typeof SESSION_CONTROL_STATUSES)[number];

export function isPauseRequested(status: SessionControlStatus): boolean {
  return status === 'pausing' || status === 'paused';
}
