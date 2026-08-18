/**
 * 设置页是 open_in_tab：Chrome 会给 chrome-extension://options.html 也带上 sender.tab。
 * 不能用「有没有 tab」判断是不是内容脚本，否则设置页自己的 SAVE/GET_SETTINGS 会被拒。
 */
export function isWebPageUrl(value?: string): boolean {
  if (!value) return false;
  return /^(https?:|file:|ftp:|blob:)/i.test(value);
}

export function isWebPageSender(sender: { url?: string; origin?: string }): boolean {
  return isWebPageUrl(sender.origin) || isWebPageUrl(sender.url);
}
