import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { NAME_WRAP_CLASS, unwrapPersonNames, wrapPersonName, wrapPersonNameInPage } from './highlight';

function htmlDoc(html: string): Document {
  const window = new Window();
  window.document.write(`<!doctype html><html><body>${html}</body></html>`);
  return window.document as unknown as Document;
}

describe('wrapPersonName', () => {
  it('wraps only the person name inside a byline', () => {
    const doc = htmlDoc(`<div class="index_about">澎湃新闻记者 张三</div>`);
    const el = doc.querySelector('.index_about')!;
    const wrap = wrapPersonName(el, '张三');
    expect(wrap?.className).toBe(NAME_WRAP_CLASS);
    expect(wrap?.textContent).toBe('张三');
    expect(el.textContent).toBe('澎湃新闻记者 张三');
    expect(el.querySelector(`.${NAME_WRAP_CLASS}`)?.textContent).toBe('张三');
    expect(el.innerHTML.includes('澎湃新闻记者')).toBe(true);
    expect(el.querySelector(`.${NAME_WRAP_CLASS}`)?.innerHTML).not.toContain('澎湃新闻记者');
  });

  it('is idempotent and can unwrap', () => {
    const doc = htmlDoc(`<p>记者：李四</p>`);
    const el = doc.querySelector('p')!;
    const first = wrapPersonName(el, '李四');
    const second = wrapPersonName(el, '李四');
    expect(second).toBe(first);
    unwrapPersonNames(doc);
    expect(doc.querySelector(`.${NAME_WRAP_CLASS}`)).toBeNull();
    expect(el.textContent).toBe('记者：李四');
  });

  it('skips comment widgets and prefers the article byline', () => {
    const doc = htmlDoc(`
      <article><div>责编：张三</div></article>
      <div class="comment">张三说得对</div>
    `);
    const wrap = wrapPersonNameInPage(doc, '张三');
    expect(wrap?.closest('article')).toBeTruthy();
    expect(wrap?.closest('.comment')).toBeNull();
  });
});
