import { fetchWithTimeout, httpStatusError, LLM_TIMEOUT_MS } from '../http';
import type { Settings } from '../types';

export function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/$/, '');
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}

/** 每次独立 messages，不沿用上一通对话。 */
export async function chatJsonObject(
  settings: Settings,
  system: string,
  user: string,
): Promise<unknown> {
  const res = await fetchWithTimeout(
    chatCompletionsUrl(settings.deepseekBaseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.deepseekApiKey.trim()}`,
      },
      body: JSON.stringify({
        model: settings.deepseekModel.trim() || 'deepseek-chat',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    },
    LLM_TIMEOUT_MS,
  );

  if (!res.ok) {
    await res.text().catch(() => '');
    throw httpStatusError('LLM', res.status);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 返回为空');
  return extractJson(content);
}
