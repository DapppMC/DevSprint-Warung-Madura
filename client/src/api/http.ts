export interface ApiErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

// Every API call goes through here. Paths are relative to /api.
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const token = localStorage.getItem('wm_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server. Pastikan API berjalan.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as ErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Terjadi kesalahan pada server.',
      error?.details ?? [],
    );
  }

  return payload as T;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.details.length > 0) {
      return `${error.message} ${error.details.map((detail) => detail.message).join('; ')}`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Terjadi kesalahan tak terduga.';
}
