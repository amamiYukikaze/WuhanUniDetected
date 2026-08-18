import { makePerson } from './hosts';
import type { BroadcastMessage, ExtensionMessage } from './messages';
import { applyLoadedSettings, isConfigured, loadSettings, saveSettings } from './settings';
import type { CheckResult, ExtractedPerson, PageState, PersonRole, ScanProgress, SearchUsage } from './types';
import { isLikelyPersonName, normalizeName, splitNameList } from './normalize';
import { MAX_SNAPSHOT_CHARS } from './page/snapshot';
import { extractPeopleFromSnapshot } from './verify/extract';
import { verifyPerson } from './verify/pipeline';
import { getSearchUsage, invalidateUsageCache } from './verify/usage';

interface TabRecord {
  tabId: number;
  pageUrl: string;
  pageTitle: string;
  autoCheck?: boolean;
  results: CheckResult[];
  scan: ScanProgress;
  scanNames: string[];
}

function idleScan(message = ''): ScanProgress {
  return { phase: 'idle', message, done: 0, total: 0 };
}

const tabs = new Map<number, TabRecord>();
const inflight = new Set<string>();
const queue: Array<() => Promise<void>> = [];
let active = 0;

function enqueue(task: () => Promise<void>) {
  queue.push(task);
  void pump();
}

async function pump() {
  if (active >= 1) return;
  const task = queue.shift();
  if (!task) return;
  active += 1;
  try {
    await task();
  } finally {
    active -= 1;
    void pump();
  }
}

function emptyState(
  tabId: number,
  pageUrl = '',
  pageTitle = '',
  configured = false,
  autoCheck = false,
): PageState {
  return {
    tabId,
    pageUrl,
    pageTitle,
    autoCheck,
    configured,
    results: [],
    scan: idleScan(),
  };
}

async function toState(record: TabRecord): Promise<PageState> {
  const settings = await loadSettings();
  let usage: SearchUsage | null = null;
  if (isConfigured(settings)) {
    usage = await getSearchUsage(settings).catch(() => null);
  }
  return {
    tabId: record.tabId,
    pageUrl: record.pageUrl,
    pageTitle: record.pageTitle,
    autoCheck: false,
    configured: isConfigured(settings),
    results: record.results,
    usage,
    scan: record.scan,
  };
}

function getRecord(tabId: number): TabRecord {
  let record = tabs.get(tabId);
  if (!record) {
    record = { tabId, pageUrl: '', pageTitle: '', results: [], scan: idleScan(), scanNames: [] };
    tabs.set(tabId, record);
  }
  return record;
}

async function broadcast(tabId: number) {
  const record = tabs.get(tabId);
  if (!record) return;
  const state = await toState(record);
  const message: BroadcastMessage = { type: 'STATE_CHANGED', state };
  await browser.runtime.sendMessage(message).catch(() => undefined);
  await browser.tabs.sendMessage(tabId, message).catch(() => undefined);
}

async function upsertResult(tabId: number, result: CheckResult) {
  const record = getRecord(tabId);
  const idx = record.results.findIndex((item) => item.person.id === result.person.id);
  if (idx >= 0) record.results[idx] = result;
  else record.results.unshift(result);
  refreshScanProgress(record);
  await broadcast(tabId);
  await browser.tabs
    .sendMessage(tabId, {
      type: 'RESULT_UPDATED',
      result,
      pageUrl: record.pageUrl,
      tabId,
    } satisfies BroadcastMessage)
    .catch(() => undefined);
}

function refreshScanProgress(record: TabRecord) {
  if (record.scan.phase !== 'checking') return;
  const names = new Set(record.scanNames);
  const mine = record.results.filter((item) => names.has(item.person.name));
  record.scan.done = mine.filter((item) => item.status === 'done' || item.status === 'error').length;
  record.scan.total = names.size;
  if (record.scan.total > 0 && record.scan.done >= record.scan.total) {
    record.scan = idleScan('本页核查结束');
  }
}

function parseManualName(raw: string): string[] {
  const trimmed = raw.trim();
  const fromList = splitNameList(trimmed);
  if (fromList.length) return fromList;
  const n = normalizeName(trimmed);
  return isLikelyPersonName(n) ? [n] : [];
}

async function runCheck(tabId: number, person: ExtractedPerson) {
  const settings = await loadSettings();
  if (!isConfigured(settings)) {
    await upsertResult(tabId, {
      person,
      status: 'error',
      error: '请先在设置页填写 DeepSeek 与搜索 API Key。',
    });
    return;
  }

  const key = `${tabId}:${person.id}`;
  if (inflight.has(key)) return;
  inflight.add(key);

  await upsertResult(tabId, { person, status: 'checking' });
  try {
    const result = await verifyPerson(person, settings);
    await upsertResult(tabId, result);
  } catch (error) {
    await upsertResult(tabId, {
      person,
      status: 'error',
      error: userFacingError(error),
    });
  } finally {
    inflight.delete(key);
  }
}

function queueCheck(tabId: number, person: ExtractedPerson) {
  enqueue(() => runCheck(tabId, person));
}

function openSidePanelNow(tabId: number) {
  const api = browser.sidePanel;
  if (!api?.open) return;
  void api.open({ tabId }).catch(() => undefined);
}

async function openSidePanel(tabId?: number) {
  const id =
    tabId ??
    (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;
  if (id == null) return;
  const api = browser.sidePanel;
  if (!api?.open) throw new Error('当前浏览器不支持 Side Panel');
  await api.open({ tabId: id });
}

function userFacingError(error: unknown): string {
  if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return '请求超时，请稍后再试。';
  }
  if (error instanceof Error) {
    if (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      /timeout|timed out|aborted/i.test(error.message)
    ) {
      return '请求超时，请稍后再试。';
    }
    if (/failed to fetch|networkerror|network error/i.test(error.message)) {
      return '无法访问该接口。请检查网络；若使用了自定义 Base URL，保存时需要允许该网站权限。';
    }
    return error.message.slice(0, 200);
  }
  return String(error).slice(0, 200);
}

function coercePerson(raw: unknown): ExtractedPerson | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.name !== 'string') return null;
  const name = normalizeName(row.name);
  if (!isLikelyPersonName(name)) return null;
  const role: PersonRole =
    row.role === 'editor' || row.role === 'manual' || row.role === 'author' ? row.role : 'author';
  const rawText =
    typeof row.rawText === 'string' ? row.rawText.replace(/\s+/g, ' ').trim().slice(0, 200) : name;
  const orgHint =
    typeof row.orgHint === 'string' && row.orgHint.trim()
      ? row.orgHint.replace(/\s+/g, ' ').trim().slice(0, 40)
      : undefined;
  return makePerson(name, role, rawText, orgHint);
}

export function initBackground() {
  const ensureMenu = async () => {
    await browser.contextMenus.removeAll().catch(() => undefined);
    await browser.contextMenus.create({
      id: 'check-whu',
      title: '检查武大成分：「%s」',
      contexts: ['selection'],
    });
  };

  void ensureMenu();
  browser.runtime.onInstalled.addListener(() => {
    void ensureMenu();
  });

  void browser.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: false })
    .catch(() => undefined);

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'check-whu' || !info.selectionText || tab?.id == null) return;
    const names = parseManualName(info.selectionText);
    const pageUrl = tab.url ?? '';
    const record = getRecord(tab.id);
    record.pageUrl = pageUrl;
    record.pageTitle = tab.title ?? record.pageTitle;
    for (const name of names) {
      queueCheck(tab.id, makePerson(name, 'manual', info.selectionText));
    }
    void openSidePanel(tab.id).catch(() => undefined);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabs.delete(tabId);
  });

  browser.runtime.onMessage.addListener(
    (message: ExtensionMessage | BroadcastMessage, sender, sendResponse) => {
      const tabId = sender.tab?.id;
      void handleMessage(message, tabId, Boolean(sender.tab))
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: userFacingError(error),
          });
        });
      return true;
    },
  );
}

async function handleMessage(
  message: ExtensionMessage | BroadcastMessage,
  senderTabId: number | undefined,
  fromContent: boolean,
) {
  if (!('type' in message)) return { ok: false, error: '无效消息' };

  if (message.type === 'STATE_CHANGED' || message.type === 'RESULT_UPDATED') {
    return { ok: true };
  }

  switch (message.type) {
    case 'GET_SETTINGS': {
      if (fromContent) return { ok: false, error: '不允许从网页脚本读取设置' };
      return { ok: true, settings: await loadSettings() };
    }
    case 'SAVE_SETTINGS': {
      if (fromContent) return { ok: false, error: '不允许从网页脚本修改设置' };
      await saveSettings(applyLoadedSettings(message.settings));
      await invalidateUsageCache();
      return { ok: true };
    }
    case 'GET_USAGE': {
      if (fromContent) return { ok: false, error: '不允许从网页脚本读取用量' };
      const settings = await loadSettings();
      const usage = await getSearchUsage(settings, Boolean(message.force));
      return { ok: true, usage };
    }
    case 'OPEN_OPTIONS': {
      await browser.runtime.openOptionsPage();
      return { ok: true };
    }
    case 'OPEN_SIDEPANEL': {
      const id = message.tabId ?? senderTabId;
      if (id != null) {
        openSidePanelNow(id);
        return { ok: true };
      }
      await openSidePanel();
      return { ok: true };
    }
    case 'GET_BADGE_SETTING': {
      return { ok: true, showUnconfirmedBadges: true };
    }
    case 'GET_PAGE_STATE': {
      const settings = await loadSettings();
      const record = tabs.get(message.tabId);
      if (!record) {
        const tab = await browser.tabs.get(message.tabId).catch(() => undefined);
        const usage = isConfigured(settings) ? await getSearchUsage(settings).catch(() => null) : null;
        return {
          ok: true,
          state: {
            ...emptyState(
              message.tabId,
              message.pageUrl || tab?.url || '',
              tab?.title || '',
              isConfigured(settings),
              false,
            ),
            usage,
          },
        };
      }
      return { ok: true, state: await toState(record) };
    }
    case 'TOGGLE_AUTO_CHECK': {
      const record = getRecord(message.tabId);
      record.autoCheck = false;
      await broadcast(message.tabId);
      return { ok: true, state: await toState(record) };
    }
    case 'SCAN_PAGE': {
      if (senderTabId == null) return { ok: false, error: '缺少标签页' };
      if (typeof message.snapshot !== 'string' || message.snapshot.length > MAX_SNAPSHOT_CHARS + 200) {
        return { ok: false, error: '页面摘录无效' };
      }
      const record = getRecord(senderTabId);
      if (record.scan.phase === 'extracting' || record.scan.phase === 'checking') {
        return { ok: false, error: '本页正在核查，请稍等。' };
      }
      const settings = await loadSettings();
      if (!isConfigured(settings)) {
        return { ok: false, error: '请先在设置页填写 DeepSeek 与搜索 API Key。' };
      }
      openSidePanelNow(senderTabId);
      record.pageUrl = typeof message.pageUrl === 'string' ? message.pageUrl.slice(0, 2000) : record.pageUrl;
      record.pageTitle = typeof message.pageTitle === 'string' ? message.pageTitle.slice(0, 200) : record.pageTitle;
      record.scan = { phase: 'extracting', message: '正在让模型筛选署名人员…', done: 0, total: 0 };
      record.scanNames = [];
      await broadcast(senderTabId);
      try {
        const people = await extractPeopleFromSnapshot(
          message.snapshot,
          typeof message.hostname === 'string' ? message.hostname.slice(0, 253) : '',
          settings,
        );
        if (!people.length) {
          record.scan = idleScan('没有识别到本稿署名人员');
          await broadcast(senderTabId);
          return { ok: true, people: [] };
        }
        const existing = new Map(record.results.map((item) => [item.person.name, item]));
        for (const person of people) {
          if (!existing.has(person.name)) {
            record.results.unshift({ person, status: 'idle' });
          }
        }
        record.scanNames = people.map((item) => item.name);
        record.scan = {
          phase: 'checking',
          message: '正在逐人检索核查…',
          done: 0,
          total: people.length,
        };
        await broadcast(senderTabId);
        for (const person of people) queueCheck(senderTabId, person);
        return { ok: true, people };
      } catch (error) {
        const err = userFacingError(error);
        record.scan = idleScan(err);
        await broadcast(senderTabId);
        return { ok: false, error: err };
      }
    }
    case 'CHECK_PERSON': {
      const tabId = senderTabId ?? (await activeTabId());
      if (tabId == null) return { ok: false, error: '找不到当前标签页' };
      const person = coercePerson(message.person);
      if (!person) return { ok: false, error: '这不太像人名，换一个再试试。' };
      const record = getRecord(tabId);
      if (typeof message.pageUrl === 'string' && message.pageUrl) record.pageUrl = message.pageUrl.slice(0, 2000);
      queueCheck(tabId, person);
      return { ok: true, state: await toState(record) };
    }
    case 'CHECK_NAME': {
      const tabId = senderTabId ?? (await activeTabId());
      if (tabId == null) return { ok: false, error: '找不到当前标签页' };
      const names = parseManualName(message.name);
      if (!names.length) return { ok: false, error: '这不太像人名，换一个再试试。' };
      const record = getRecord(tabId);
      if (typeof message.pageUrl === 'string' && message.pageUrl) record.pageUrl = message.pageUrl.slice(0, 2000);
      for (const name of names) {
        queueCheck(tabId, makePerson(name, 'manual', message.name, message.orgHint));
      }
      return { ok: true, state: await toState(record) };
    }
    default:
      return { ok: false, error: '未知消息' };
  }
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}
