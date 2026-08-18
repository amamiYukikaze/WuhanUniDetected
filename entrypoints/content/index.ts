import { isNewsHost } from '../../lib/hosts';
import {
  BADGE_ATTR,
  NAME_WRAP_ATTR,
  NAME_WRAP_CLASS,
  unwrapPersonNames,
  wrapPersonName,
  wrapPersonNameInPage,
} from '../../lib/highlight';
import type { BroadcastMessage, ExtensionMessage } from '../../lib/messages';
import { sendMessage } from '../../lib/messages';
import { makePerson } from '../../lib/hosts';
import { isLikelyPersonName, normalizeName } from '../../lib/normalize';
import { collectPageSnapshot } from '../../lib/page/snapshot';
import type { CheckResult, ExtractedPerson, LocalPerson, ScanProgress } from '../../lib/types';
import { badgeLabel } from '../../lib/ui/labels';
import './style.css';

const HOST_ATTR = 'data-whu-host';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main(ctx) {
    const anchors = new Map<string, Element>();
    let extracted: LocalPerson[] = [];
    let lastUrl = location.href;
    let floatHost: HTMLElement | null = null;
    let ballHost: HTMLElement | null = null;
    let ballChecking = false;

    const serialize = (person: LocalPerson): ExtractedPerson => ({
      id: person.id,
      name: person.name,
      role: person.role,
      rawText: person.rawText,
      orgHint: person.orgHint,
    });

    function clearHighlights() {
      unwrapPersonNames(document);
      anchors.clear();
      extracted = [];
    }

    function clearNewsUi() {
      clearHighlights();
      ballChecking = false;
      hideBall();
    }

    function highlightPeople(people: LocalPerson[]) {
      for (const person of people) {
        if (!person.element || !person.element.isConnected) continue;
        const wrap = wrapPersonName(person.element, person.name);
        const target = wrap ?? person.element;
        anchors.set(person.name, target);
        if (!wrap) continue;
        wrap.setAttribute('title', '点击核查武大成分');
        wrap.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            void sendMessage({
              type: 'CHECK_PERSON',
              person: serialize(person),
              pageUrl: location.href,
            });
          },
          true,
        );
      }
    }

    function boot() {
      clearHighlights();
      hideBall();
      if (!isNewsHost(location.hostname)) return;
      renderBall();
    }

    function hideBall() {
      ballHost?.remove();
      ballHost = null;
    }

    function ballText(scan?: ScanProgress): string {
      if (scan?.phase === 'extracting') return '筛';
      if (scan?.phase === 'checking') return `${scan.done}/${scan.total || '?'}`;
      return '查';
    }

    function ballTitle(scan?: ScanProgress): string {
      if (scan?.phase === 'extracting' || scan?.phase === 'checking') {
        return scan.message || '正在核查…';
      }
      return scan?.message || '把本页正文发给模型筛选署名，再逐人核查（进页不会自动发生）';
    }

    function renderBall(scan?: ScanProgress) {
      hideBall();
      if (!isNewsHost(location.hostname)) return;
      ballHost = document.createElement('div');
      ballHost.setAttribute(HOST_ATTR, 'ball');
      ballHost.style.position = 'fixed';
      ballHost.style.right = '10px';
      ballHost.style.top = '36%';
      ballHost.style.zIndex = '2147480000';
      const shadow = ballHost.attachShadow({ mode: 'open' });
      const scanning = scan?.phase === 'extracting' || scan?.phase === 'checking';
      shadow.innerHTML = `
        <style>
          :host { all: initial; }
          button {
            width: 28px;
            height: 28px;
            border: 0;
            border-radius: 50%;
            padding: 0;
            background: #8b1e2d;
            color: #fff;
            font: 11px/1 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(31, 23, 21, .22);
            opacity: .88;
          }
          button:hover { opacity: 1; }
          button:disabled { cursor: default; opacity: .7; }
        </style>
        <button type="button"></button>
      `;
      const btn = shadow.querySelector('button');
      if (btn) {
        btn.textContent = ballText(scan);
        btn.title = ballTitle(scan);
        btn.disabled = scanning;
      }
      btn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (ballChecking) return;
        void sendMessage({ type: 'OPEN_SIDEPANEL' });
        void scanPageWithLlm();
      });
      document.documentElement.append(ballHost);
    }

    async function scanPageWithLlm() {
      ballChecking = true;
      syncBall({ phase: 'extracting', message: '正在让模型筛选署名人员…', done: 0, total: 0 });
      try {
        let snapshot: string;
        try {
          snapshot = collectPageSnapshot(document, location.href, document.title);
        } catch {
          snapshot = [
            `标题: ${document.title}`,
            `URL: ${location.href}`,
            '---',
            (document.body?.innerText || '').slice(0, 48_000),
          ].join('\n');
        }
        const res = await sendMessage<{ ok: true; people: ExtractedPerson[] } | { ok: false; error: string }>({
          type: 'SCAN_PAGE',
          snapshot,
          pageUrl: location.href,
          pageTitle: document.title,
          hostname: location.hostname,
        });
        if (!res.ok) {
          ballChecking = false;
          syncBall({ phase: 'idle', message: res.error, done: 0, total: 0 });
          return;
        }
        clearHighlights();
        extracted = res.people.map((person) => ({
          ...person,
          element: wrapPersonNameInPage(document, person.name),
        }));
        highlightPeople(extracted);
      } catch (error) {
        ballChecking = false;
        const message =
          error instanceof Error ? error.message : '核查失败，请刷新页面后重试。';
        syncBall({ phase: 'idle', message, done: 0, total: 0 });
      }
    }

    function syncBall(scan?: ScanProgress) {
      const scanning = scan?.phase === 'extracting' || scan?.phase === 'checking';
      ballChecking = scanning;
      if (!ballHost) {
        renderBall(scan);
        return;
      }
      const btn = ballHost.shadowRoot?.querySelector('button');
      if (!btn) return;
      btn.disabled = scanning;
      btn.textContent = ballText(scan);
      btn.title = ballTitle(scan);
    }

    function shouldShowBadge(result: CheckResult): boolean {
      if (result.status === 'checking') return true;
      if (result.status !== 'done') return false;
      return (
        result.verdict === 'confirmed' ||
        result.verdict === 'possible' ||
        result.verdict === 'unrelated' ||
        result.verdict === 'not_found'
      );
    }

    function upsertBadge(result: CheckResult) {
      const anchor = anchors.get(result.person.name);
      if (!anchor || !anchor.isConnected) return;
      const existing = Array.from(
        anchor.parentElement?.querySelectorAll(`[${BADGE_ATTR}]`) ?? [],
      ).find((node) => node.getAttribute(BADGE_ATTR) === result.person.name);
      if (!shouldShowBadge(result)) {
        existing?.remove();
        return;
      }
      const badge = (existing as HTMLElement | null) ?? document.createElement('span');
      badge.setAttribute(BADGE_ATTR, result.person.name);
      badge.className = 'whu-check-badge';
      badge.classList.toggle('whu-check-badge--checking', result.status === 'checking');
      badge.classList.toggle('whu-check-badge--confirmed', result.verdict === 'confirmed');
      badge.classList.toggle('whu-check-badge--possible', result.verdict === 'possible');
      badge.classList.toggle(
        'whu-check-badge--clear',
        result.verdict === 'unrelated' || result.verdict === 'not_found',
      );
      badge.textContent = badgeLabel(result.verdict, result.status === 'checking');
      badge.title = result.reason || result.error || badge.textContent;
      badge.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        void sendMessage({ type: 'OPEN_SIDEPANEL' });
      };
      if (!existing) {
        anchor.insertAdjacentElement('afterend', badge);
      }
    }

    function hideFloat() {
      floatHost?.remove();
      floatHost = null;
    }

    function selectionName(): string | null {
      const text = window.getSelection()?.toString().trim() ?? '';
      const name = normalizeName(text);
      if (!isLikelyPersonName(name)) return null;
      return name;
    }

    function selectionStartPoint(fallbackX: number, fallbackY: number): { x: number; y: number } {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return { x: fallbackX, y: fallbackY };
      const range = sel.getRangeAt(0);
      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0 && rect.left === 0 && rect.top === 0)) {
        return { x: fallbackX, y: fallbackY };
      }
      return { x: rect.left - 10, y: rect.top - 10 };
    }

    function showFloat(x: number, y: number, name: string) {
      hideFloat();
      const left = Math.max(4, x + window.scrollX);
      const top = Math.max(4, y + window.scrollY);
      floatHost = document.createElement('div');
      floatHost.setAttribute(HOST_ATTR, 'float');
      floatHost.style.position = 'absolute';
      floatHost.style.left = `${left}px`;
      floatHost.style.top = `${top}px`;
      floatHost.style.zIndex = '2147483000';
      const shadow = floatHost.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          .hit {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: 0;
            background: transparent;
            cursor: pointer;
            position: relative;
          }
          .dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #8b1e2d;
            box-shadow: 0 0 0 1px #fff, 0 1px 3px rgba(139, 30, 45, .35);
            pointer-events: none;
          }
          .tip {
            display: none;
            position: absolute;
            left: 50%;
            bottom: calc(100% + 4px);
            transform: translateX(-50%);
            font: 10px/1 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            background: #1f1715;
            color: #fff;
            padding: 3px 5px;
            border-radius: 3px;
            white-space: nowrap;
            pointer-events: none;
          }
          .hit:hover .tip { display: block; }
        </style>
        <button class="hit" type="button" aria-label="查成分">
          <span class="dot"></span>
          <span class="tip">查成分</span>
        </button>
      `;
      shadow.querySelector('button')?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const range = window.getSelection()?.rangeCount
          ? window.getSelection()?.getRangeAt(0)
          : null;
        const person = makePerson(name, 'manual', name);
        if (range && !range.collapsed) {
          let node: Node | null = range.commonAncestorContainer;
          if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
          if (node instanceof Element) {
            const wrap =
              node.closest?.(`.${NAME_WRAP_CLASS}`) ??
              Array.from(node.querySelectorAll?.(`[${NAME_WRAP_ATTR}]`) ?? []).find(
                (item) => item.getAttribute(NAME_WRAP_ATTR) === name,
              );
            anchors.set(name, wrap instanceof Element ? wrap : node);
          }
        }
        void sendMessage({
          type: 'CHECK_PERSON',
          person,
          pageUrl: location.href,
        });
        hideFloat();
      });
      document.documentElement.append(floatHost);
    }

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (floatHost && (target === floatHost || floatHost.contains(target))) return;
      hideFloat();
    };

    const onMouseUp = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(`.${NAME_WRAP_CLASS}`)) return;
      if (floatHost && (target === floatHost || floatHost.contains(target))) return;
      if (ballHost && (target === ballHost || ballHost.contains(target))) return;
      ctx.setTimeout(() => {
        const name = selectionName();
        if (!name) {
          hideFloat();
          return;
        }
        const point = selectionStartPoint(event.clientX - 10, event.clientY - 10);
        showFloat(point.x, point.y, name);
      }, 10);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    ctx.setInterval(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      void boot();
    }, 1200);

    browser.runtime.onMessage.addListener((message: BroadcastMessage | ExtensionMessage) => {
      if (message.type === 'RESULT_UPDATED') {
        upsertBadge(message.result);
      }
      if (message.type === 'STATE_CHANGED') {
        for (const result of message.state.results) upsertBadge(result);
        syncBall(message.state.scan);
      }
    });

    ctx.onInvalidated(() => {
      hideFloat();
      clearNewsUi();
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousedown', onMouseDown);
    });

    void boot();
    ctx.setTimeout(() => void boot(), 1500);
  },
});
