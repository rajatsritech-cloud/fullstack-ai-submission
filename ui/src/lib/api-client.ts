export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type RequestOptions = RequestInit & {
  params?: Record<string, string>;
};

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, ...init } = options;

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
  ) {
    super(`${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

export type SSECallbacks<TEvents extends Record<string, unknown>> = {
  [K in keyof TEvents]?: (data: TEvents[K]) => void;
} & {
  onError?: (error: Error) => void;
};

export async function streamSSE<TEvents extends Record<string, unknown>>(
  endpoint: string,
  body: unknown,
  callbacks: SSECallbacks<TEvents>,
  signal?: AbortSignal,
): Promise<void> {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const eventMatch = part.match(/^event:\s*(.+)$/m);
        const dataMatch = part.match(/^data:\s*(.+)$/m);
        if (!eventMatch || !dataMatch) continue;

        const eventName = eventMatch[1].trim();
        const rawData = dataMatch[1].trim();

        const callback = callbacks[eventName as keyof TEvents];
        if (callback) {
          try {
            (callback as (data: unknown) => void)(JSON.parse(rawData));
          } catch {
            (callback as (data: unknown) => void)(rawData);
          }
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
