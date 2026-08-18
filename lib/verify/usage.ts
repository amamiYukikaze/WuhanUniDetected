import { fetchWithTimeout, httpStatusError, USAGE_TIMEOUT_MS } from '../http';
import { clampWarnPercent } from '../settings';
import type { SearchUsage, Settings } from '../types';

const USAGE_CACHE_KEY = 'whu.search-usage';
const LOCAL_COUNTER_KEY = 'whu.search-local-count';
const CACHE_MS = 45_000;

interface CachedUsage {
  usage: SearchUsage;
  savedAt: number;
}

interface LocalCounter {
  month: string;
  credits: number;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function decorate(
  used: number,
  limit: number | null,
  settings: Settings,
  extra: Pick<SearchUsage, 'provider' | 'plan' | 'paygo' | 'source' | 'error'>,
): SearchUsage {
  const percent = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : null;
  const warnPercent = clampWarnPercent(settings.usageWarnPercent);
  const overUser = percent != null && percent >= warnPercent;
  const overPlan = limit != null && used >= limit;
  const extraPay = extra.paygo || overPlan || overUser;
  return {
    provider: extra.provider,
    plan: extra.plan,
    paygo: extra.paygo,
    source: extra.source,
    error: extra.error,
    used,
    limit,
    percent,
    warn: extraPay,
    extraPay,
    fetchedAt: Date.now(),
  };
}

export async function readLocalSearchCredits(): Promise<number> {
  const stored = await browser.storage.local.get(LOCAL_COUNTER_KEY);
  const raw = stored[LOCAL_COUNTER_KEY] as LocalCounter | undefined;
  if (!raw || raw.month !== currentMonth()) return 0;
  return raw.credits;
}

export async function addLocalSearchCredits(count: number): Promise<void> {
  if (count <= 0) return;
  const month = currentMonth();
  const stored = await browser.storage.local.get(LOCAL_COUNTER_KEY);
  const raw = stored[LOCAL_COUNTER_KEY] as LocalCounter | undefined;
  const credits = raw?.month === month ? raw.credits + count : count;
  await browser.storage.local.set({ [LOCAL_COUNTER_KEY]: { month, credits } });
}

export async function invalidateUsageCache(): Promise<void> {
  await browser.storage.local.remove(USAGE_CACHE_KEY);
}

export async function getSearchUsage(
  settings: Settings,
  force = false,
): Promise<SearchUsage | null> {
  if (!settings.searchApiKey.trim()) return null;

  if (!force) {
    const cached = await browser.storage.local.get(USAGE_CACHE_KEY);
    const hit = cached[USAGE_CACHE_KEY] as CachedUsage | undefined;
    if (hit?.usage && Date.now() - hit.savedAt < CACHE_MS && hit.usage.provider === settings.searchProvider) {
      return decorate(hit.usage.used, hit.usage.limit, settings, hit.usage);
    }
  }

  let usage: SearchUsage;
  if (settings.searchProvider === 'tavily') {
    usage = await fetchTavilyUsage(settings);
  } else {
    usage = decorate(await readLocalSearchCredits(), null, settings, {
      provider: settings.searchProvider,
      paygo: false,
      source: 'local',
    });
  }

  await browser.storage.local.set({
    [USAGE_CACHE_KEY]: { usage, savedAt: Date.now() } satisfies CachedUsage,
  });
  return usage;
}

async function fetchTavilyUsage(settings: Settings): Promise<SearchUsage> {
  try {
    const res = await fetchWithTimeout(
      'https://api.tavily.com/usage',
      {
        headers: { Authorization: `Bearer ${settings.searchApiKey.trim()}` },
      },
      USAGE_TIMEOUT_MS,
    );
    if (!res.ok) {
      throw httpStatusError('Tavily 用量', res.status);
    }
    const json = (await res.json()) as {
      key?: { usage?: number; limit?: number | null };
      account?: {
        current_plan?: string;
        plan_usage?: number;
        plan_limit?: number | null;
        paygo_usage?: number;
      };
    };
    const used = json.account?.plan_usage ?? json.key?.usage ?? 0;
    const limit = json.account?.plan_limit ?? json.key?.limit ?? null;
    const paygo = (json.account?.paygo_usage ?? 0) > 0;
    return decorate(used, limit, settings, {
      provider: 'tavily',
      plan: json.account?.current_plan,
      paygo,
      source: 'tavily',
    });
  } catch (error) {
    const local = await readLocalSearchCredits();
    return decorate(local, 1000, settings, {
      provider: 'tavily',
      paygo: false,
      source: 'local',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function usageSummary(usage: SearchUsage): string {
  const limitText = usage.limit == null ? '不限' : String(usage.limit);
  const percentText = usage.percent == null ? '' : `（${usage.percent}%）`;
  const planText = usage.plan ? `${usage.plan} · ` : '';
  const sourceText = usage.source === 'local' ? '本机估算' : 'Tavily 本周期';
  return `${sourceText} ${planText}${usage.used} / ${limitText} credits${percentText}`;
}
