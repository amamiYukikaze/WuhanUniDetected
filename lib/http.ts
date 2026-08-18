export const LLM_TIMEOUT_MS = 90_000;
export const SEARCH_TIMEOUT_MS = 20_000;
export const USAGE_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export function httpStatusError(service: string, status: number): Error {
  if (status === 401 || status === 403) return new Error(`${service} 鉴权失败，请检查 API Key。`);
  if (status === 429) return new Error(`${service} 请求过于频繁，请稍后再试。`);
  return new Error(`${service} 调用失败（${status}）`);
}
