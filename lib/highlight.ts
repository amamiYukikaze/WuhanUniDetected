export const NAME_WRAP_CLASS = 'whu-check-name';
export const NAME_WRAP_ATTR = 'data-whu-name';
export const BADGE_ATTR = 'data-whu-badge';

const SHOW_TEXT = 4;

function isNoisyWrapHost(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (/^(NAV|SCRIPT|STYLE|NOSCRIPT|IFRAME|SVG)$/i.test(cur.tagName)) return true;
    const bag = `${cur.id} ${typeof cur.className === 'string' ? cur.className : ''}`.toLowerCase();
    if (/comment|pinglun|discuss/.test(bag)) return true;
    cur = cur.parentElement;
  }
  return false;
}

export function wrapPersonName(element: Element, name: string): HTMLElement | null {
  if (!name || !element) return null;
  if (element.classList.contains(NAME_WRAP_CLASS) && element.getAttribute(NAME_WRAP_ATTR) === name) {
    return element as HTMLElement;
  }
  const existing = Array.from(element.querySelectorAll(`.${NAME_WRAP_CLASS}`)).find(
    (node) => node.getAttribute(NAME_WRAP_ATTR) === name,
  );
  if (existing) return existing as HTMLElement;

  const doc = element.ownerDocument;
  const walker = doc.createTreeWalker(element, SHOW_TEXT);
  let textNode: Text | null = null;
  let idx = -1;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const parentEl = current.parentElement;
    if (isNoisyWrapHost(parentEl)) continue;
    const text = current.textContent ?? '';
    const found = text.indexOf(name);
    if (found < 0) continue;
    if (parentEl?.classList.contains(NAME_WRAP_CLASS) && parentEl.getAttribute(NAME_WRAP_ATTR) === name) {
      return parentEl;
    }
    textNode = current as Text;
    idx = found;
    break;
  }
  if (!textNode || idx < 0) return null;

  const raw = textNode.textContent ?? '';
  const before = raw.slice(0, idx);
  const after = raw.slice(idx + name.length);
  const wrap = doc.createElement('span');
  wrap.className = NAME_WRAP_CLASS;
  wrap.setAttribute(NAME_WRAP_ATTR, name);
  wrap.textContent = name;

  const parent = textNode.parentNode;
  if (!parent) return null;
  if (before) parent.insertBefore(doc.createTextNode(before), textNode);
  parent.insertBefore(wrap, textNode);
  if (after) parent.insertBefore(doc.createTextNode(after), textNode);
  parent.removeChild(textNode);
  return wrap;
}

export function unwrapPersonNames(root: ParentNode): void {
  const scope = root as Document | Element;
  const wraps = Array.from(scope.querySelectorAll?.(`.${NAME_WRAP_CLASS}`) ?? []);
  for (const wrap of wraps) {
    const parent = wrap.parentNode;
    if (!parent) continue;
    while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
    parent.removeChild(wrap);
    parent.normalize();
  }
  const badges = Array.from(scope.querySelectorAll?.(`[${BADGE_ATTR}]`) ?? []);
  for (const badge of badges) badge.remove();
}

export function wrapPersonNameInPage(doc: Document, name: string): HTMLElement | null {
  const article =
    doc.querySelector('article') ??
    doc.querySelector('#rwb_zw, .rm_txt_con, [class*="article-content"], [class*="article_content"]');
  if (article) {
    const hit = wrapPersonName(article, name);
    if (hit) return hit;
  }
  return doc.body ? wrapPersonName(doc.body, name) : null;
}

