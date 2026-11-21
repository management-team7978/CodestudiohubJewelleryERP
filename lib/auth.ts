import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { getDb, setting } from './db';

const SECRET = new TextEncoder().encode(process.env.ERP_SECRET || 'dev-only-change-me-in-production-please');
export type Session = { uid: number; name: string; role: string; roleId: number; isSuper: boolean; kind: string; onboarded: boolean };
export type Perm = { can_view: number; can_add: number; can_edit: number; can_delete: number };

export async function ip(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '127.0.0.1';
}

export async function createSession(uid: number) {
  const mins = Number(setting('session_minutes', '30')) || 30;
  const token = await new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(`${mins * 4}m`).sign(SECRET);
  (await cookies()).set('erp_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.ERP_HTTPS === '1', path: '/', maxAge: mins * 240 });
}
export async function destroySession() { (await cookies()).delete('erp_session'); }

export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get('erp_session')?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, SECRET);
    const u = getDb().prepare('SELECT u.id,u.name,u.kind,u.onboarded,u.active,u.locked,r.id rid,r.name rname,r.is_super FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=?').get(payload.uid as number) as any;
    if (!u || !u.active || u.locked) return null;
    return { uid: u.id, name: u.name, role: u.rname, roleId: u.rid, isSuper: !!u.is_super, kind: u.kind, onboarded: !!u.onboarded };
  } catch { return null; }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export function permOf(s: Session, module: string): Perm {
  if (s.isSuper) return { can_view: 1, can_add: 1, can_edit: 1, can_delete: 1 };
  const p = getDb().prepare('SELECT can_view,can_add,can_edit,can_delete FROM role_perms WHERE role_id=? AND module=?').get(s.roleId, module) as Perm | undefined;
  return p || { can_view: 0, can_add: 0, can_edit: 0, can_delete: 0 };
}

/** Server-side guard: every page & action calls this. */
export async function guard(module: string, need: 'view' | 'add' | 'edit' | 'delete' = 'view'): Promise<Session> {
  const s = await requireSession();
  if (!permOf(s, module)[`can_${need}` as keyof Perm]) redirect('/forbidden?m=' + module);
  return s;
}

export function audit(s: Session | null, module: string, action: string, ref = '', oldV: unknown = null, newV: unknown = null, ipAddr = '') {
  getDb().prepare('INSERT INTO audit_log(user_id,user_name,module,action,ref,old_value,new_value,ip) VALUES(?,?,?,?,?,?,?,?)')
    .run(s?.uid ?? null, s?.name ?? 'system', module, action, ref, oldV == null ? null : JSON.stringify(oldV), newV == null ? null : JSON.stringify(newV), ipAddr);
}

export function ipAllowed(addr: string): boolean {
  if (setting('ip_enforce', '0') !== '1') return true;
  if (['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(addr) && process.env.NODE_ENV !== 'production') return true;
  const rows = getDb().prepare('SELECT ip FROM ip_rules').all() as { ip: string }[];
  return rows.some((r) => r.ip === addr);
}
