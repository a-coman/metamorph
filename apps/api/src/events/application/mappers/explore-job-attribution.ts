import { JobType } from '../../../../generated/prisma/enums.js';

export type ExploreJobAttribution = {
  mrVersionId: string | null;
  transformFamily: string | null;
};

export type JobAttributionContext = {
  exploreJobs: Map<string, ExploreJobAttribution>;
  mrFamilies: Map<string, string>;
  jobTypes: Map<string, JobType>;
};

type JobRow = {
  id: string;
  type: JobType;
  mrVersionId: string | null;
  payload: unknown;
};

export function buildJobAttributionContext(
  jobs: JobRow[],
  mrFamilies: Map<string, string> = new Map(),
): JobAttributionContext {
  const exploreJobs = new Map<string, ExploreJobAttribution>();
  const jobTypes = new Map<string, JobType>();

  for (const job of jobs) {
    jobTypes.set(job.id, job.type);

    if (job.type !== JobType.explore) {
      continue;
    }

    const payload = job.payload as Record<string, unknown> | null;
    const payloadFamily =
      typeof payload?.transform_family === 'string' ? payload.transform_family : null;
    const mrVersionId = job.mrVersionId ?? null;
    const transformFamily =
      payloadFamily ?? (mrVersionId ? mrFamilies.get(mrVersionId) ?? null : null);

    exploreJobs.set(job.id, { mrVersionId, transformFamily });
  }

  return { exploreJobs, mrFamilies, jobTypes };
}

export function resolveExploreAttribution(
  exploreJobId: string | null | undefined,
  context: JobAttributionContext,
): ExploreJobAttribution | null {
  if (!exploreJobId) {
    return null;
  }
  return context.exploreJobs.get(exploreJobId) ?? null;
}

export function resolveTransformFamily(
  mrVersionId: string | null | undefined,
  context: JobAttributionContext,
): string | null {
  if (!mrVersionId) {
    return null;
  }
  return context.mrFamilies.get(mrVersionId) ?? null;
}
