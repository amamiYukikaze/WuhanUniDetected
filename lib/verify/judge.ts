import { safeHref } from '../safe-url';
import type { JudgeOutput, Quote, SearchSnippet, Settings, Verdict, Relation } from '../types';
import { chatJsonObject } from './llm';

const SYSTEM_PROMPT = `你是履历核实助手，只根据用户提供的搜索片段判断某人是否与武汉大学存在学历或人事关系。

硬性规则：
1. 禁止使用你自己的记忆、训练数据或猜测作为「确认」依据。没有片段支撑就不能 confirmed。
2. confirmed 仅当片段明确写明：毕业于武汉大学 / 武汉大学本科或研究生 / 武汉大学教授副教授讲师 / 武大在读 / 武汉大学研究员 等人事或学历关系。
3. 仅报道过武汉大学、采访武大、稿件出现武大、转发武大新闻 → relation=mentioned_only，verdict=unrelated。
4. 武汉理工大学、武汉科技大学等「武汉xx大学」不等于武汉大学。武汉大学人民医院的任职可以算。简称「武大」可以算。
5. 同名但供职媒体/单位与线索明显不符 → unrelated。
6. 片段不足或只是搜索目录 → not_found。
7. quotes.text 必须是某条片段 title 或 snippet 中出现过的连续子串，quotes.url 必须是对应片段的 url。
8. 只输出 JSON，不要 markdown。

JSON 形状：
{
  "verdict": "confirmed" | "possible" | "unrelated" | "not_found",
  "relation": "alumni" | "faculty" | "student" | "honorary" | "mentioned_only" | "unknown",
  "reason": "一句话中文理由",
  "quotes": [{ "text": "原句子串", "url": "https://..." }],
  "confidence": 0.0
}`;

function snippetBlob(snippet: SearchSnippet): string {
  return `${snippet.title}\n${snippet.snippet}`;
}

function normalizeBlob(text: string): string {
  return text.replace(/\s+/g, '');
}

function quoteSupported(quote: Quote, snippets: SearchSnippet[]): boolean {
  const needle = normalizeBlob(quote.text);
  if (needle.length < 6) return false;
  const urlHit = snippets.find((s) => s.url && s.url === quote.url);
  const pool = urlHit ? [urlHit, ...snippets] : snippets;
  return pool.some((s) => normalizeBlob(snippetBlob(s)).includes(needle));
}

function coerceVerdict(value: unknown): Verdict {
  const v = String(value);
  if (v === 'confirmed' || v === 'possible' || v === 'unrelated' || v === 'not_found') return v;
  return 'not_found';
}

function coerceRelation(value: unknown): Relation {
  const v = String(value);
  if (
    v === 'alumni' ||
    v === 'faculty' ||
    v === 'student' ||
    v === 'honorary' ||
    v === 'mentioned_only' ||
    v === 'unknown'
  ) {
    return v;
  }
  return 'unknown';
}

export function validateJudgeOutput(
  raw: unknown,
  snippets: SearchSnippet[],
): JudgeOutput {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let verdict = coerceVerdict(obj.verdict);
  let relation = coerceRelation(obj.relation);
  const reason = typeof obj.reason === 'string' ? obj.reason.slice(0, 300) : '';
  const quotesIn = Array.isArray(obj.quotes) ? obj.quotes : [];
  const quotes: Quote[] = quotesIn
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const q = item as { text?: unknown; url?: unknown };
      if (typeof q.text !== 'string' || typeof q.url !== 'string') return null;
      const href = safeHref(q.url.trim());
      if (!href) return null;
      return { text: q.text.trim().slice(0, 280), url: href };
    })
    .filter((item): item is Quote => Boolean(item))
    .filter((quote) => quoteSupported(quote, snippets));

  if (verdict === 'confirmed' && quotes.length === 0) {
    verdict = snippets.length ? 'possible' : 'not_found';
  }
  if (verdict === 'confirmed' && relation === 'mentioned_only') {
    verdict = 'unrelated';
  }
  if (!snippets.length) {
    verdict = 'not_found';
    relation = 'unknown';
  }

  return { verdict, relation, reason, quotes };
}

export async function judgePerson(
  name: string,
  snippets: SearchSnippet[],
  settings: Settings,
  orgHint?: string,
): Promise<JudgeOutput> {
  if (!snippets.length) {
    return {
      verdict: 'not_found',
      relation: 'unknown',
      reason: '没有检索到可引用的公开履历片段。',
      quotes: [],
    };
  }

  const packed = snippets.map((s, i) => `#${i + 1}\n标题: ${s.title}\nURL: ${s.url}\n片段: ${s.snippet}`).join('\n\n');
  const user = `待核实姓名：${name}${orgHint ? `\n线索单位/媒体：${orgHint}` : ''}
目标：是否与「武汉大学 / 武大 / Wuhan University」存在学历或人事关系。

搜索片段：
${packed}`;

  const raw = await chatJsonObject(settings, SYSTEM_PROMPT, user);
  return validateJudgeOutput(raw, snippets);
}
