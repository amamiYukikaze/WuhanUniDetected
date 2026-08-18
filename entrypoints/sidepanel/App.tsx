import { useEffect, useState } from 'react';
import type { BroadcastMessage } from '../../lib/messages';
import { sendMessage } from '../../lib/messages';
import { safeHref } from '../../lib/safe-url';
import type { CheckResult, PageState } from '../../lib/types';
import { relationLabel, roleLabel, verdictLabel } from '../../lib/ui/labels';
import { SEARCH_CALLS_PER_CHECK } from '../../lib/verify/search';
import { usageSummary } from '../../lib/verify/usage';

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

function tagClass(result: CheckResult): string {
  if (result.status === 'checking') return 'tag checking';
  if (result.verdict === 'confirmed') return 'tag confirmed';
  if (result.verdict === 'possible') return 'tag possible';
  if (result.verdict === 'unrelated' || result.verdict === 'not_found') return 'tag clear';
  return 'tag';
}

function ResultCard({ result }: { result: CheckResult }) {
  const [open, setOpen] = useState(result.verdict === 'confirmed' || result.verdict === 'possible');
  return (
    <article className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{result.person.name}</strong>
        <span className={tagClass(result)}>
          {result.status === 'checking' ? '核查中' : verdictLabel(result.verdict)}
        </span>
      </div>
      {result.paidHint && <span className="tag paid">本次检测需要额外付费</span>}
      <p className="meta">
        {roleLabel(result.person.role)}
        {result.person.orgHint ? ` · ${result.person.orgHint}` : ''}
        {result.relation ? ` · ${relationLabel(result.relation)}` : ''}
        {result.fromCache ? ' · 缓存' : ''}
      </p>
      {result.error && <p className="error">{result.error}</p>}
      {result.reason && <p className="meta">{result.reason}</p>}
      {(result.status === 'idle' || result.status === 'error') && (
        <button
          className="btn secondary"
          onClick={() => sendMessage({ type: 'CHECK_PERSON', person: result.person })}
        >
          {result.status === 'error' ? '重试' : '检查'}
        </button>
      )}
      {!!result.quotes?.length && (
        <>
          <button className="btn secondary" onClick={() => setOpen((v) => !v)}>
            {open ? '收起引用' : '查看引用'}
          </button>
          {open && (
            <ul className="quotes">
              {result.quotes.map((quote) => {
                const href = safeHref(quote.url);
                return (
                  <li key={`${quote.url}-${quote.text}`}>
                    {quote.text}{' '}
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        来源
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </article>
  );
}

export default function App() {
  const [state, setState] = useState<PageState | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const tab = await activeTab();
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
    const onMessage = (message: BroadcastMessage) => {
      if (message.type === 'STATE_CHANGED') {
        void (async () => {
          const tab = await activeTab();
          if (tab?.id === message.state.tabId) setState(message.state);
        })();
      }
    };
    const onActivated = () => void refresh();
    const onUpdated = (tabId: number, info: { status?: string }) => {
      if (info.status === 'complete') void refresh();
      void tabId;
    };
    browser.runtime.onMessage.addListener(onMessage);
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.runtime.onMessage.removeListener(onMessage);
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return (
    <div className="wrap">
      <h1>武大成分检测</h1>
      <p className="sub">{state?.pageTitle || '点新闻页右侧悬浮球筛署名，或在这里手动输入人名。'}</p>
      {!state?.configured && (
        <div className="banner">
          还没配置 API Key。
          <button className="btn secondary" style={{ marginLeft: 8 }} onClick={() => sendMessage({ type: 'OPEN_OPTIONS' })}>
            去设置
          </button>
        </div>
      )}
      {state?.usage && (
        <div className={state.usage.warn ? 'banner warn' : 'banner'}>
          {usageSummary(state.usage)}
          {state.usage.warn
            ? ` · 已过你设的 ${state.usage.percent ?? '?'}% 预警，之后每次检查都会标「本次检测需要额外付费」。`
            : ` · 每人约 ${SEARCH_CALLS_PER_CHECK} 次搜索 / ${SEARCH_CALLS_PER_CHECK} credits（Tavily basic）。`}
          {state.usage.error ? ` · ${state.usage.error}` : ''}
        </div>
      )}
      <form
        className="row"
        style={{ marginBottom: 12 }}
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          setBusy(true);
          try {
            const tab = await activeTab();
            const res = await sendMessage<{ ok: true } | { ok: false; error: string }>({
              type: 'CHECK_NAME',
              name,
              pageUrl: tab?.url,
            });
            if (!res.ok) setError(res.error);
            else setName('');
            await refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="输入或粘贴人名"
          aria-label="人名"
        />
        <button className="btn" disabled={busy || !name.trim()}>
          检查
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {state?.scan && (state.scan.phase !== 'idle' || state.scan.message) && (
        <div className="banner" style={{ marginBottom: 12 }}>
          <p className="meta" style={{ margin: 0 }}>
            {state.scan.phase === 'extracting'
              ? '正在让模型筛选署名人员…'
              : state.scan.phase === 'checking'
                ? `正在逐人检索核查 ${state.scan.done}/${state.scan.total}`
                : state.scan.message}
          </p>
          {state.scan.phase === 'checking' && state.scan.total > 0 && (
            <div className="progress" aria-hidden="true">
              <span style={{ width: `${Math.round((state.scan.done / state.scan.total) * 100)}%` }} />
            </div>
          )}
        </div>
      )}
      <p className="meta" style={{ marginBottom: 12 }}>
        进页不请求接口。点右侧悬浮球会先让模型筛署名，再逐人走搜索和判定，请耐心等进度。
      </p>
      <div className="list">
        {(state?.results ?? []).map((result) => (
          <ResultCard key={result.person.id} result={result} />
        ))}
        {!state?.results.length && <p className="meta">还没有检查记录。可以点悬浮球、划词、右键，或在这里输入人名。</p>}
      </div>
    </div>
  );
}
