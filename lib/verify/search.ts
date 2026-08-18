import { fetchWithTimeout, httpStatusError, SEARCH_TIMEOUT_MS } from '../http';
import type { PersonRole, SearchProviderId, SearchSnippet, Settings } from '../types';

const MAX_PER_QUERY = 8;
export const SEARCH_CALLS_PER_CHECK = 3;

function uniqueSnippets(items: SearchSnippet[]): SearchSnippet[] {
  const seen = new Set<string>();
  const out: SearchSnippet[] = [];
  for (const item of items) {
    const key = item.url.replace(/\/$/, '') || item.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: item.title.slice(0, 180),
      url: item.url,
      snippet: item.snippet.slice(0, 500),
    });
  }
  return out;
}

async function searchBocha(query: string, apiKey: string): Promise<SearchSnippet[]> {
  const res = await fetchWithTimeout(
    'https://api.bochaai.com/v1/web-search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        freshness: 'noLimit',
        summary: true,
        count: MAX_PER_QUERY,
      }),
    },
    SEARCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw httpStatusError('博查搜索', res.status);
  }
  const json = (await res.json()) as {
    data?: { webPages?: { value?: Array<{ name?: string; url?: string; snippet?: string; summary?: string }> } };
    msg?: string;
    message?: string;
  };
  const values = json.data?.webPages?.value ?? [];
  return values.map((item) => ({
    title: item.name ?? '',
    url: item.url ?? '',
    snippet: item.summary || item.snippet || '',
  }));
}

async function searchSerper(query: string, apiKey: string): Promise<SearchSnippet[]> {
  const res = await fetchWithTimeout(
    'https://google.serper.dev/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
        hl: 'zh-cn',
        gl: 'cn',
        num: MAX_PER_QUERY,
      }),
    },
    SEARCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw httpStatusError('Serper', res.status);
  }
  const json = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (json.organic ?? []).map((item) => ({
    title: item.title ?? '',
    url: item.link ?? '',
    snippet: item.snippet ?? '',
  }));
}

async function searchTavily(query: string, apiKey: string): Promise<SearchSnippet[]> {
  const res = await fetchWithTimeout(
    'https://api.tavily.com/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: MAX_PER_QUERY,
      }),
    },
    SEARCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw httpStatusError('Tavily', res.status);
  }
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (json.results ?? []).map((item) => ({
    title: item.title ?? '',
    url: item.url ?? '',
    snippet: item.content ?? '',
  }));
}

const PROVIDERS: Record<
  SearchProviderId,
  (query: string, apiKey: string) => Promise<SearchSnippet[]>
> = {
  bocha: searchBocha,
  serper: searchSerper,
  tavily: searchTavily,
};

export function roleSearchTerm(role?: PersonRole): string {
  if (role === 'editor') return '编辑';
  if (role === 'author') return '记者';
  return '';
}

export function buildSearchQueries(name: string, orgHint?: string, role?: PersonRole): string[] {
  const quoted = `"${name}"`;
  const job = roleSearchTerm(role);
  const queries = [`${quoted} 武汉大学`];
  if (job) queries.push(`${quoted} ${job} 武汉大学`);
  else queries.push(`${quoted} 简历 OR 简介`);
  if (orgHint) queries.push(`${quoted} ${orgHint} 武汉大学`);
  else queries.push(`${quoted} site:baike.baidu.com`);
  return queries.slice(0, SEARCH_CALLS_PER_CHECK);
}

export async function searchPerson(
  name: string,
  settings: Settings,
  orgHint?: string,
  role?: PersonRole,
): Promise<{ snippets: SearchSnippet[]; queryCount: number }> {
  const search = PROVIDERS[settings.searchProvider];
  const queries = buildSearchQueries(name, orgHint, role);
  const batches: SearchSnippet[] = [];
  for (const query of queries) {
    const hits = await search(query, settings.searchApiKey.trim());
    batches.push(...hits);
  }
  return {
    snippets: uniqueSnippets(batches).slice(0, 12),
    queryCount: queries.length,
  };
}
