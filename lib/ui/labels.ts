import type { PersonRole, Relation, Verdict } from '../types';

export function verdictLabel(verdict?: Verdict): string {
  switch (verdict) {
    case 'confirmed':
      return '检测到武汉大学成分！';
    case 'possible':
      return '疑似武汉大学，请仔细核查';
    case 'unrelated':
    case 'not_found':
      return '未查询到武汉大学成分~';
    default:
      return '待检查';
  }
}

export function badgeLabel(verdict?: Verdict, checking = false): string {
  if (checking) return '核查中';
  return verdictLabel(verdict);
}

export function relationLabel(relation?: Relation): string {
  switch (relation) {
    case 'alumni':
      return '校友';
    case 'faculty':
      return '教职/任职';
    case 'student':
      return '在读';
    case 'honorary':
      return '名誉关系';
    case 'mentioned_only':
      return '仅报道/提及';
    default:
      return '未知';
  }
}

export function roleLabel(role: PersonRole): string {
  switch (role) {
    case 'author':
      return '作者/记者';
    case 'editor':
      return '编辑';
    case 'manual':
      return '手动';
  }
}
