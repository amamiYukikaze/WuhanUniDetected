import type { CheckResult, JudgeOutput, SearchSnippet } from './types';
import { cacheKey } from './normalize';

const CACHE_PREFIX = 'whu-cache:';
const CONFIRMED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;

interface CacheEntry {
  verdict: CheckResult['verdict'];
  relation: CheckResult['relation'];
  reason?: string;
  quotes?: CheckResult['quotes'];
  sources?: SearchSnippet[];
  savedAt: number;
}

function ttlFor(verdict: CheckResult['verdict']): number {
  if (verdict === 'not_found' || verdict === 'unrelated') return NOT_FOUND_TTL_MS;
  return CONFIRMED_TTL_MS;
}

let writesSincePrune = 0;

async function pruneCache(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const kept: Array<{ key: string; savedAt: number }> = [];
  const expired: string[] = [];
  const now = Date.now();
  for (const [key, value] of Object.entries(all)) {
    if (!isCacheKey(key)) continue;
    const entry = value as CacheEntry | undefined;
    if (!entry?.savedAt || !entry.verdict || now - entry.savedAt > ttlFor(entry.verdict)) {
      expired.push(key);
      continue;
    }
    kept.push({ key, savedAt: entry.savedAt });
  }
  if (expired.length) await browser.storage.local.remove(expired);
  if (kept.length <= MAX_CACHE_ENTRIES) return;
  kept.sort((a, b) => a.savedAt - b.savedAt);
  const drop = kept.slice(0, kept.length - MAX_CACHE_ENTRIES).map((item) => item.key);
  if (drop.length) await browser.storage.local.remove(drop);
}

export async function readCache(
  name: string,
  orgHint?: string,
): Promise<CacheEntry | null> {
  const key = cacheKey(name, orgHint);
  const stored = await browser.storage.local.get(key);
  const entry = stored[key] as CacheEntry | undefined;
  if (!entry?.savedAt || !entry.verdict) return null;
  if (Date.now() - entry.savedAt > ttlFor(entry.verdict)) {
    await browser.storage.local.remove(key);
    return null;
  }
  return entry;
}

export async function writeCache(
  name: string,
  orgHint: string | undefined,
  output: JudgeOutput & { sources: SearchSnippet[] },
): Promise<void> {
  const key = cacheKey(name, orgHint);
  const entry: CacheEntry = {
    verdict: output.verdict,
    relation: output.relation,
    reason: output.reason,
    quotes: output.quotes,
    sources: output.sources,
    savedAt: Date.now(),
  };
  await browser.storage.local.set({ [key]: entry });
  writesSincePrune += 1;
  if (writesSincePrune >= 10) {
    writesSincePrune = 0;
    await pruneCache().catch(() => undefined);
  }
}

export function isCacheKey(key: string): boolean {
  return key.startsWith(CACHE_PREFIX) || key.startsWith('whu-cache:v1:');
}
