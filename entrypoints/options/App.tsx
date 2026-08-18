import { useEffect, useState } from 'react';
import { extraOriginFromBaseUrl } from '../../lib/safe-url';
import { sendMessage } from '../../lib/messages';
import { DEFAULT_SETTINGS } from '../../lib/settings';
import type { SearchProviderId, SearchUsage, Settings } from '../../lib/types';
import { SEARCH_CALLS_PER_CHECK } from '../../lib/verify/search';
import { usageSummary } from '../../lib/verify/usage';

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState('');
  const [usage, setUsage] = useState<SearchUsage | null>(null);
  const [usageBusy, setUsageBusy] = useState(false);

  async function refreshUsage(force = false) {
    setUsageBusy(true);
    try {
      const res = await sendMessage<{ ok: true; usage: SearchUsage | null } | { ok: false; error: string }>({
        type: 'GET_USAGE',
        force,
      });
      if (res.ok) setUsage(res.usage);
    } finally {
      setUsageBusy(false);
    }
  }

  useEffect(() => {
    void sendMessage<{ ok: true; settings: Settings } | { ok: false; error: string }>({ type: 'GET_SETTINGS' }).then(
      (res) => {
        if (res.ok) setSettings(res.settings);
      },
    );
    void refreshUsage();
  }, []);

  function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved('');
  }

  return (
    <div className="wrap">
      <h1>武大成分检测 · 设置</h1>
      <p className="sub">Key 只存在你这台浏览器的本地存储里，不会进仓库，也不会发到我们自己的服务器。</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const extra = extraOriginFromBaseUrl(settings.deepseekBaseUrl);
          if (extra) {
            const granted = await browser.permissions.request({ origins: [extra] }).catch(() => false);
            if (!granted) {
              setSaved('已记下设置，但自定义接口权限被拒绝，调用会失败');
            }
          }
          const res = await sendMessage<{ ok: true } | { ok: false; error: string }>({
            type: 'SAVE_SETTINGS',
            settings,
          });
          setSaved(res.ok ? '已保存' : res.error);
          void refreshUsage(true);
        }}
      >
        <div className="field">
          <label htmlFor="deepseekApiKey">DeepSeek API Key</label>
          <input
            id="deepseekApiKey"
            type="password"
            value={settings.deepseekApiKey}
            onChange={(event) => patch('deepseekApiKey', event.target.value)}
            placeholder="sk-..."
            autoComplete="new-password"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label htmlFor="deepseekBaseUrl">DeepSeek Base URL</label>
          <input
            id="deepseekBaseUrl"
            value={settings.deepseekBaseUrl}
            onChange={(event) => patch('deepseekBaseUrl', event.target.value)}
          />
          <p className="meta">
            默认 DeepSeek。若改成其他 OpenAI 兼容 HTTPS 地址，保存时浏览器会询问是否允许访问该网站。
          </p>
        </div>
        <div className="field">
          <label htmlFor="deepseekModel">模型</label>
          <input
            id="deepseekModel"
            value={settings.deepseekModel}
            onChange={(event) => patch('deepseekModel', event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="searchProvider">搜索接口</label>
          <select
            id="searchProvider"
            value={settings.searchProvider}
            onChange={(event) => patch('searchProvider', event.target.value as SearchProviderId)}
          >
            <option value="bocha">博查 Bocha（中文源优先）</option>
            <option value="serper">Serper（Google）</option>
            <option value="tavily">Tavily</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="searchApiKey">搜索 API Key</label>
          <input
            id="searchApiKey"
            type="password"
            value={settings.searchApiKey}
            onChange={(event) => patch('searchApiKey', event.target.value)}
            autoComplete="new-password"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label htmlFor="usageWarnPercent">搜索用量预警阈值（%）</label>
          <input
            id="usageWarnPercent"
            type="number"
            min={1}
            max={100}
            value={settings.usageWarnPercent}
            onChange={(event) => patch('usageWarnPercent', Number(event.target.value))}
          />
          <p className="meta">
            到达这个百分比后，侧栏会提示，并且之后每次非缓存检查会标「本次检测需要额外付费」。
            Tavily 免费档通常每月 1000 credits；basic 搜索 1 次 = 1 credit，每人约 {SEARCH_CALLS_PER_CHECK} credits。
          </p>
        </div>
        {usage && (
          <div className={usage.warn ? 'banner warn' : 'banner'}>
            {usageSummary(usage)}
            {usage.warn ? ' · 已过预警阈值' : ''}
            {usage.error ? ` · ${usage.error}` : ''}
          </div>
        )}
        <button
          type="button"
          className="btn secondary"
          style={{ marginBottom: 12 }}
          disabled={usageBusy}
          onClick={() => refreshUsage(true)}
        >
          {usageBusy ? '正在拉取用量…' : '刷新搜索用量'}
        </button>
        <p className="meta" style={{ marginBottom: 16 }}>
          默认进页<strong>什么都不做</strong>。点新闻页右侧深红悬浮球，才会把去掉脚本/评论区后的正文发给 DeepSeek 筛署名，再逐人搜索核查，会比较慢。
          划词小红点、右键菜单和侧栏输入仍然可以查单个名字。
        </p>
        <div className="row">
          <button className="btn">保存</button>
          {saved && <span className="meta">{saved}</span>}
        </div>
      </form>
      <p className="meta" style={{ marginTop: 20 }}>
        DeepSeek：https://platform.deepseek.com ；博查：https://open.bochaai.com ；Serper：https://serper.dev ；Tavily：https://tavily.com
      </p>
    </div>
  );
}
