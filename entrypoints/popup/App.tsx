import { useEffect, useState } from 'react';
import { sendMessage } from '../../lib/messages';
import { isConfigured } from '../../lib/settings';
import type { PageState, Settings } from '../../lib/types';

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export default function App() {
  const [state, setState] = useState<PageState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const tab = await activeTab();
    const settingsRes = await sendMessage<{ ok: true; settings: Settings } | { ok: false; error: string }>({
      type: 'GET_SETTINGS',
    });
    if (settingsRes.ok) setSettings(settingsRes.settings);
    if (tab?.id == null) return;
    const res = await sendMessage<{ ok: true; state: PageState } | { ok: false; error: string }>({
      type: 'GET_PAGE_STATE',
      tabId: tab.id,
      pageUrl: tab.url,
    });
    if (res.ok) setState(res.state);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const configured = settings ? isConfigured(settings) : false;
  const checking = state?.results.filter((item) => item.status === 'checking').length ?? 0;
  const confirmed = state?.results.filter((item) => item.verdict === 'confirmed').length ?? 0;

  return (
    <div className="wrap">
      <h1>武大成分检测</h1>
      <p className="sub">{state?.pageTitle || '当前页面'}</p>
      {!configured && (
        <div className="banner">还没有 API Key，先去设置里填 DeepSeek 和搜索接口。</div>
      )}
      <p className="meta" style={{ marginBottom: 12 }}>
        进页不查询。点新闻页右侧悬浮球才会让模型筛署名并逐人核查。
      </p>
      <p className="meta">
        已记录 {state?.results.length ?? 0} 人
        {checking ? ` · 核查中 ${checking}` : ''}
        {confirmed ? ` · 确认 ${confirmed}` : ''}
      </p>
      {state?.usage && (
        <p className="meta">
          {state.usage.warn ? '搜索用量已过预警，之后检查可能额外付费。' : `搜索用量 ${state.usage.used}${state.usage.limit != null ? ` / ${state.usage.limit}` : ''} credits`}
        </p>
      )}
      <div className="row">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const tab = await activeTab();
              await sendMessage({ type: 'OPEN_SIDEPANEL', tabId: tab?.id });
              window.close();
            } finally {
              setBusy(false);
            }
          }}
        >
          打开侧栏
        </button>
        <button
          className="btn secondary"
          onClick={() => sendMessage({ type: 'OPEN_OPTIONS' })}
        >
          设置
        </button>
      </div>
    </div>
  );
}
