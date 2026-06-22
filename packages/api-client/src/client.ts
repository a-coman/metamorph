import type {
  ArtifactUrlDto,
  CreateSessionResultDto,
  ExecuteMrVersionResultDto,
  ExplorationTimelineDto,
  MrVersionDetailsDto,
  PageSnapshotDto,
  PauseSessionResultDto,
  QueueDiscoverResultDto,
  ResumeSessionResultDto,
  SessionActivityDto,
  SessionDetailsDto,
  SessionListDto,
} from './index.js';
import type {
  ApproveMrVersionRequest,
  RejectMrVersionResultDto,
} from './types/mr-version.js';
import type {
  ApproveMrVersionResultDto,
  RunDetailsDto,
  RunSummaryDto,
} from './types/run.js';

export type ApiClientConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export type ApiClient = ReturnType<typeof createApiClient>;

async function request<T>(
  config: ApiClientConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const fetchFn = config.fetch ?? fetch;
  const response = await fetchFn(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `API ${init?.method ?? 'GET'} ${path} failed (${response.status}): ${body}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export function createApiClient(config: ApiClientConfig) {
  const json = <T>(path: string, init?: RequestInit) =>
    request<T>(config, path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

  return {
    createSession(body: {
      url: string;
      mode?: string;
      generateCount?: number;
      weakOracle?: boolean;
    }) {
      return json<CreateSessionResultDto>('/sessions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    listSessions(params?: { limit?: number; cursor?: string }) {
      const search = new URLSearchParams();
      if (params?.limit !== undefined) {
        search.set('limit', String(params.limit));
      }
      if (params?.cursor) {
        search.set('cursor', params.cursor);
      }
      const query = search.toString();
      return json<SessionListDto>(`/sessions${query ? `?${query}` : ''}`);
    },

    getSession(id: string) {
      return json<SessionDetailsDto>(`/sessions/${id}`);
    },

    getSessionActivity(id: string) {
      return json<SessionActivityDto>(`/sessions/${id}/activity`);
    },

    queueDiscover(sessionId: string) {
      return json<QueueDiscoverResultDto>(`/sessions/${sessionId}/discover`, {
        method: 'POST',
      });
    },

    pauseSession(sessionId: string) {
      return json<PauseSessionResultDto>(`/sessions/${sessionId}/pause`, {
        method: 'POST',
      });
    },

    resumeSession(sessionId: string) {
      return json<ResumeSessionResultDto>(`/sessions/${sessionId}/resume`, {
        method: 'POST',
      });
    },

    getMrVersion(id: string) {
      return json<MrVersionDetailsDto>(`/mr-versions/${id}`);
    },

    getExploration(mrVersionId: string) {
      return json<ExplorationTimelineDto>(`/mr-versions/${mrVersionId}/exploration`);
    },

    getPlaybook(mrVersionId: string) {
      return request<string>(config, `/mr-versions/${mrVersionId}/playbook`, {
        headers: { Accept: 'text/plain' },
      });
    },

    approveMrVersion(mrVersionId: string, body?: ApproveMrVersionRequest) {
      return json<ApproveMrVersionResultDto>(`/mr-versions/${mrVersionId}/approve`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
    },

    rejectMrVersion(mrVersionId: string) {
      return json<RejectMrVersionResultDto>(`/mr-versions/${mrVersionId}/reject`, {
        method: 'POST',
      });
    },

    executeMrVersion(mrVersionId: string) {
      return json<ExecuteMrVersionResultDto>(`/mr-versions/${mrVersionId}/execute`, {
        method: 'POST',
      });
    },

    listRuns(mrVersionId: string) {
      return json<RunSummaryDto[]>(`/mr-versions/${mrVersionId}/runs`);
    },

    getRun(runId: string) {
      return json<RunDetailsDto>(`/runs/${runId}`);
    },

    getArtifactUrl(artifactId: string) {
      return json<ArtifactUrlDto>(`/artifacts/${artifactId}/url`);
    },

    getPageSnapshot(snapshotId: string) {
      return json<PageSnapshotDto>(`/page-snapshots/${snapshotId}`);
    },
  };
}
