import type {
  AccuracyResponse,
  ApiErrorPayload,
  BriefResponse,
  DriftResponse,
  MetaResponse,
} from './types';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export class ApiError extends Error {
  public status: number;
  public detail: string | ApiErrorPayload['detail'];

  constructor(status: number, detail: string | ApiErrorPayload['detail']) {
    let message = `API request failed with status ${status}`;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
    }
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

const sessionCache = new Map<string, unknown>();

async function request<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  if (sessionCache.has(url)) {
    return sessionCache.get(url) as T;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    let errorDetail: string | ApiErrorPayload['detail'] = response.statusText;
    try {
      const errorJson = (await response.json()) as ApiErrorPayload;
      if (errorJson && errorJson.detail) {
        errorDetail = errorJson.detail;
      }
    } catch {
      // Non-JSON error payload
    }
    throw new ApiError(response.status, errorDetail);
  }

  const data = (await response.json()) as T;
  sessionCache.set(url, data);
  return data;
}

export const apiClient = {
  getMeta(signal?: AbortSignal): Promise<MetaResponse> {
    return request<MetaResponse>('/api/meta', signal);
  },

  getBrief(date: string, cutoff: string, signal?: AbortSignal): Promise<BriefResponse> {
    const params = new URLSearchParams({ date, cutoff });
    return request<BriefResponse>(`/api/brief?${params.toString()}`, signal);
  },

  getDrift(date: string, cutoff: string, signal?: AbortSignal): Promise<DriftResponse> {
    const params = new URLSearchParams({ date, cutoff });
    return request<DriftResponse>(`/api/drift?${params.toString()}`, signal);
  },

  getAccuracy(cutoff: string, signal?: AbortSignal): Promise<AccuracyResponse> {
    const params = new URLSearchParams({ cutoff });
    return request<AccuracyResponse>(`/api/accuracy?${params.toString()}`, signal);
  },
};
