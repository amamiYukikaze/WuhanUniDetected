const MEDIA_ORGS = [
  '澎湃新闻',
  '澎湃',
  '新华社',
  '新华网',
  '人民日报',
  '人民网',
  '观察者网',
  '界面新闻',
  '界面',
  '央视新闻',
  '央视网',
  '央视',
  '中国新闻网',
  '中新网',
  '光明日报',
  '经济日报',
  '环球时报',
  '本报',
  '本网',
  '综合',
  '来源',
];

const STOP_NAMES = new Set([
  '不详',
  '未知',
  '佚名',
  '匿名',
  '网络',
  '资料',
  '图片',
  '视频',
  '编辑部',
  '评论',
  '快讯',
  '直播',
  '全文',
  '原文',
  '相关',
  '推荐',
  '首页',
  '原创',
  '独家',
  '转载',
  '来源',
  '记者',
  '编辑',
  '作者',
  '北京',
  '天津',
  '上海',
  '重庆',
  '河北',
  '河南',
  '山东',
  '山西',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '湖南',
  '湖北',
  '广东',
  '海南',
  '四川',
  '贵州',
  '云南',
  '陕西',
  '甘肃',
  '青海',
  '辽宁',
  '吉林',
  '广西',
  '宁夏',
  '新疆',
  '西藏',
  '内蒙古',
  '黑龙江',
  '香港',
  '澳门',
  '台湾',
]);

const NAME_LIKE =
  /^(?:[\u4e00-\u9fff]{2,4}|[\u4e00-\u9fff]{1,4}·[\u4e00-\u9fff]{1,6})$/;

export function normalizeName(name: string): string {
  return name
    .replace(/[\s\u00a0]+/g, '')
    .replace(/[“”"']/g, '')
    .replace(/[．.]/g, '·')
    .trim();
}

export function isLikelyPersonName(name: string): boolean {
  const n = normalizeName(name);
  if (!n || n.length < 2 || n.length > 8) return false;
  if (STOP_NAMES.has(n)) return false;
  if (n.startsWith('记者') || n.startsWith('编辑') || n.startsWith('作者')) return false;
  if (MEDIA_ORGS.includes(n)) return false;
  if (n.includes('大学') || n.includes('学院') || n.includes('新闻')) return false;
  return NAME_LIKE.test(n);
}

export function splitNameList(raw: string): string[] {
  const cleaned = raw
    .replace(/（.*?）|\(.*?\)/g, '')
    .replace(/等$/, '')
    .replace(
      new RegExp(`^(?:${MEDIA_ORGS.slice().sort((a, b) => b.length - a.length).join('|')})`, 'g'),
      '',
    )
    .trim();

  const parts = cleaned
    .split(/[、，,;；/／|｜和&]+|\s+/)
    .map((p) => normalizeName(p))
    .filter(Boolean);

  return [...new Set(parts.filter(isLikelyPersonName))];
}

export function cacheKey(name: string, orgHint?: string): string {
  const n = normalizeName(name);
  const org = orgHint ? normalizeName(orgHint) : '';
  return `whu-cache:v1:${n}:${org}`;
}
