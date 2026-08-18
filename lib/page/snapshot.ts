export const MAX_SNAPSHOT_CHARS = 48_000;

const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS', 'TEMPLATE', 'LINK']);

function noisyBag(el: Element): string {
  return `${el.id} ${typeof el.className === 'string' ? el.className : ''}`.toLowerCase();
}

export function isNoisyRegion(el: Element): boolean {
  const bag = noisyBag(el);
  return /comment|pinglun|discuss|hot-list|hotlist|recommend|related|sharebox|share-box|\bad[-_]|[-_]ad\b|advert|footer-nav/.test(
    bag,
  );
}

function shouldDrop(el: Element): boolean {
  if (DROP_TAGS.has(el.tagName)) return true;
  if (el.closest('nav')) return true;
  return isNoisyRegion(el);
}

function jsonLdAuthors(doc: Document): string[] {
  const names: string[] = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent || 'null') as unknown;
      pullAuthors(data, names);
    } catch {
      // ignore
    }
  }
  return [...new Set(names)];
}

function pullAuthors(data: unknown, names: string[]) {
  if (!data) return;
  if (Array.isArray(data)) {
    for (const item of data) pullAuthors(item, names);
    return;
  }
  if (typeof data !== 'object') return;
  const obj = data as Record<string, unknown>;
  if (obj['@graph']) pullAuthors(obj['@graph'], names);
  if (obj.author) takeAuthor(obj.author, names);
}

function takeAuthor(author: unknown, names: string[]) {
  if (!author) return;
  if (typeof author === 'string') {
    names.push(author.trim());
    return;
  }
  if (Array.isArray(author)) {
    for (const item of author) takeAuthor(item, names);
    return;
  }
  if (typeof author === 'object' && author && 'name' in author) {
    const name = (author as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) names.push(name.trim());
  }
}

function metaHints(doc: Document): string[] {
  const keys = ['author', 'authors', 'article:author', 'twitter:creator', 'description'];
  const out: string[] = [];
  for (const key of keys) {
    const el =
      doc.querySelector(`meta[name="${key}"]`) ?? doc.querySelector(`meta[property="${key}"]`);
    const content = el?.getAttribute('content')?.trim();
    if (content) out.push(`${key}: ${content.slice(0, 300)}`);
  }
  return out;
}

function collapse(text: string): string {
  return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 给模型看的页面摘录：丢掉脚本/导航/评论区，保留正文和署名栏。
 * 不是带广告追踪的原始 HTML。
 */
export function collectPageSnapshot(doc: Document, pageUrl: string, pageTitle?: string): string {
  try {
    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    const doomed: Element[] = [];
    for (const el of clone.querySelectorAll('*')) {
      if (shouldDrop(el)) doomed.push(el);
    }
    for (const el of doomed) el.remove();

    const article =
      clone.querySelector('article') ??
      clone.querySelector('#rwb_zw, .rm_txt_con, [class*="article-content"], [class*="article_content"]');
    const bodyText = collapse((article ?? clone.querySelector('body') ?? clone).textContent || '');

    const header = [
      `标题: ${pageTitle || doc.title || ''}`,
      `URL: ${pageUrl}`,
      ...metaHints(doc).map((line) => `meta ${line}`),
      ...jsonLdAuthors(doc).map((name) => `JSON-LD author: ${name}`),
      '---',
      bodyText,
    ].join('\n');

    if (header.length <= MAX_SNAPSHOT_CHARS) return header;
    return `${header.slice(0, MAX_SNAPSHOT_CHARS)}\n…[截断]`;
  } catch {
    const fallback = [
      `标题: ${pageTitle || doc.title || ''}`,
      `URL: ${pageUrl}`,
      '---',
      collapse((doc.body?.textContent || '').slice(0, MAX_SNAPSHOT_CHARS)),
    ].join('\n');
    return fallback.length <= MAX_SNAPSHOT_CHARS ? fallback : `${fallback.slice(0, MAX_SNAPSHOT_CHARS)}\n…[截断]`;
  }
}
