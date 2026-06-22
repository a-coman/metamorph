import type { SessionControlStatus } from './session-control-status.js';

export type SessionControlReader = {
  getControlStatus(sessionId: string): Promise<SessionControlStatus | null>;
};

export class SessionControlChecker {
  constructor(private readonly reader: SessionControlReader) {}

  async getStatus(sessionId: string): Promise<SessionControlStatus> {
    return (await this.reader.getControlStatus(sessionId)) ?? 'active';
  }

  async isPauseRequested(sessionId: string): Promise<boolean> {
    const status = await this.getStatus(sessionId);
    return status === 'pausing' || status === 'paused';
  }
}
