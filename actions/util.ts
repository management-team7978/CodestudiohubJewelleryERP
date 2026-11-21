import { getDb, todayStr } from '@/lib/db';
export const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
export const num = (f: FormData, k: string) => { const v = parseFloat(String(f.get(k) ?? '').replace(/,/g, '')); return Number.isFinite(v) ? v : 0; };
export const int = (f: FormData, k: string) => Math.trunc(num(f, k));
export const dateOr = (f: FormData, k: string) => str(f, k) || todayStr();
export type Res = { ok: boolean; msg: string };
export const ok = (msg: string): Res => ({ ok: true, msg });
export const bad = (msg: string): Res => ({ ok: false, msg });
export function nextNo(prefix: string, table: string, col = 'no', pad = 4) {
  const r = getDb().prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${col} LIKE ?`).get(prefix + '%') as { c: number };
  return prefix + String(r.c + 1 + (prefix.startsWith('ORD') ? 1000 : 0)).padStart(prefix.startsWith('ORD') ? 0 : pad, '0');
}
export function postGold(o: { date: string; acct_type: string; acct_id: number; dir: 'IN' | 'OUT'; gross: number; touch: number; fine: number; ref_type: string; ref_id?: number; order_id?: number; narration?: string; by?: number }) {
  getDb().prepare('INSERT INTO gold_ledger(date,acct_type,acct_id,dir,gross,touch,fine,ref_type,ref_id,order_id,narration,by_user) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(o.date, o.acct_type, o.acct_id, o.dir, o.gross, o.touch, o.fine, o.ref_type, o.ref_id ?? null, o.order_id ?? null, o.narration ?? '', o.by ?? null);
}
export function goldBalance(acct_type: string, acct_id: number) {
  return getDb().prepare("SELECT COALESCE(SUM(CASE dir WHEN 'IN' THEN gross ELSE -gross END),0) gross, COALESCE(SUM(CASE dir WHEN 'IN' THEN fine ELSE -fine END),0) fine FROM gold_ledger WHERE acct_type=? AND acct_id=?").get(acct_type, acct_id) as { gross: number; fine: number };
}
