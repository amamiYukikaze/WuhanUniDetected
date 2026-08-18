import type { CheckResult, ExtractedPerson, PageState, SearchUsage, Settings } from './types';

export type ExtensionMessage =
  | {
      type: 'SCAN_PAGE';
      snapshot: string;
      pageUrl: string;
      pageTitle: string;
      hostname: string;
    }
  | { type: 'CHECK_PERSON'; person: ExtractedPerson; pageUrl?: string }
  | { type: 'CHECK_NAME'; name: string; orgHint?: string; pageUrl?: string }
  | { type: 'GET_PAGE_STATE'; tabId: number; pageUrl?: string }
  | { type: 'TOGGLE_AUTO_CHECK'; tabId: number; enabled: boolean }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Settings }
  | { type: 'OPEN_SIDEPANEL'; tabId?: number }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'GET_BADGE_SETTING' }
  | { type: 'GET_USAGE'; force?: boolean };

export type ExtensionResponse =
  | { ok: true; state: PageState }
  | { ok: true; settings: Settings }
  | { ok: true; showUnconfirmedBadges: boolean }
  | { ok: true; usage: SearchUsage | null }
  | { ok: true; people: ExtractedPerson[] }
  | { ok: true }
  | { ok: false; error: string };

export type BroadcastMessage =
  | { type: 'STATE_CHANGED'; state: PageState }
  | { type: 'RESULT_UPDATED'; result: CheckResult; pageUrl: string; tabId: number };

export async function sendMessage<T extends ExtensionResponse>(
  message: ExtensionMessage,
): Promise<T> {
  try {
    const res = (await browser.runtime.sendMessage(message)) as T | undefined;
    if (res) return res;
    return { ok: false, error: '扩展后台无响应，请尝试重新加载扩展。' } as T;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/invalidated|receiving end does not exist|could not establish connection/i.test(msg)) {
      return { ok: false, error: '扩展已重新加载，请刷新页面后再试。' } as T;
    }
    return { ok: false, error: msg || '消息发送失败' } as T;
  }
}
