import { ProbeTracePrismaRepository } from '../../infrastructure/persistence/probe-trace-prisma.repository.js';

export class SaveProbeTraceService {
  constructor(
    private readonly probeTraceRepository: ProbeTracePrismaRepository = new ProbeTracePrismaRepository(),
  ) {}

  async execute(input: {
    sessionId: string;
    jobId: string;
    pageSnapshotId?: string | null;
    traceZip: Buffer;
  }): Promise<string> {
    return this.probeTraceRepository.save(input);
  }
}
