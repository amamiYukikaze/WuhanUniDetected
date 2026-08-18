const PRIVATE_V4 =
  /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|223\.255\.255\.|255\.|100\.(?:6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.)/;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host === '0.0.0.0') return true;
  if (PRIVATE_V4.test(host)) return true;
  return false;
}

export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** 侧栏引用链接：只允许 http(s)，避免 javascript:/data: XSS。 */
export function safeHref(raw: string | undefined): string | null {
  if (!raw) return null;
  const url = parseHttpUrl(raw);
  if (!url) return null;
  return url.toString();
}

export function sanitizeLlmBaseUrl(raw: string, fallback: string): string {
  try {
    const url = new URL((raw || fallback).trim());
    if (url.protocol !== 'https:') return fallback;
    if (url.username || url.password) return fallback;
    if (isBlockedHost(url.hostname)) return fallback;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export const BUILTIN_HOST_PERMISSIONS = [
  'https://api.deepseek.com/*',
  'https://api.bochaai.com/*',
  'https://google.serper.dev/*',
  'https://api.tavily.com/*',
] as const;

/** 自定义 LLM 基址若超出内置 host_permissions，需要向用户申请 optional origin。 */
export function extraOriginFromBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') return null;
    const pattern = `${url.origin}/*`;
    if ((BUILTIN_HOST_PERMISSIONS as readonly string[]).includes(pattern)) return null;
    return pattern;
  } catch {
    return null;
  }
}
