import { sanitizeLlmBaseUrl } from './safe-url';
import type { SearchProviderId, Settings } from './types';

export const SETTINGS_KEY = 'whu.settings';

export const DEFAULT_SETTINGS: Settings = {
  deepseekApiKey: '',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekModel: 'deepseek-chat',
  searchProvider: 'bocha',
  searchApiKey: '',
  autoCheck: false,
  showUnconfirmedBadges: false,
  usageWarnPercent: 80,
};

const SEARCH_PROVIDERS: SearchProviderId[] = ['bocha', 'serper', 'tavily'];

function coerceProvider(value: unknown): SearchProviderId {
  return SEARCH_PROVIDERS.includes(value as SearchProviderId)
    ? (value as SearchProviderId)
    : DEFAULT_SETTINGS.searchProvider;
}

/** 合并本地存储时一律关掉进页自动核查，避免旧的 autoCheck: true 继续烧钱。 */
export function applyLoadedSettings(
  raw?: Partial<Settings> & { localHeuristicExtract?: unknown },
): Settings {
  const { autoCheck: _autoCheck, localHeuristicExtract: _heuristic, ...rest } = raw ?? {};
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...rest,
    usageWarnPercent: clampWarnPercent(raw?.usageWarnPercent ?? DEFAULT_SETTINGS.usageWarnPercent),
    autoCheck: false,
  };
  merged.deepseekApiKey = typeof merged.deepseekApiKey === 'string' ? merged.deepseekApiKey : '';
  merged.searchApiKey = typeof merged.searchApiKey === 'string' ? merged.searchApiKey : '';
  merged.deepseekModel =
    typeof merged.deepseekModel === 'string' && merged.deepseekModel.trim()
      ? merged.deepseekModel.trim().slice(0, 80)
      : DEFAULT_SETTINGS.deepseekModel;
  merged.deepseekBaseUrl = sanitizeLlmBaseUrl(
    typeof merged.deepseekBaseUrl === 'string' ? merged.deepseekBaseUrl : '',
    DEFAULT_SETTINGS.deepseekBaseUrl,
  );
  merged.searchProvider = coerceProvider(merged.searchProvider);
  return merged;
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const raw = stored[SETTINGS_KEY] as Partial<Settings> | undefined;
  const next = applyLoadedSettings(raw);
  if (raw?.autoCheck === true) {
    await browser.storage.local.set({ [SETTINGS_KEY]: next });
  }
  return next;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const next = {
    ...settings,
    usageWarnPercent: clampWarnPercent(settings.usageWarnPercent),
    autoCheck: false,
  };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
}

export function isConfigured(settings: Settings): boolean {
  return Boolean(settings.deepseekApiKey.trim() && settings.searchApiKey.trim());
}

export function clampWarnPercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.usageWarnPercent;
  return Math.min(100, Math.max(1, Math.round(n)));
}
