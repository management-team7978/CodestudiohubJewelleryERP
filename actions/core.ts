'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb, MODULES, setSetting } from '@/lib/db';
import { audit, createSession, destroySession, guard, ip, ipAllowed, requireSession } from '@/lib/auth';
import { bad, int, num, ok, Res, str } from './util';

export async function loginAction(_: Res | null, f: FormData): Promise<Res> {
  const email = str(f, 'email').toLowerCase(); const pass = str(f, 'password'); const addr = await ip();
  const db = getDb(); const log = (okk: number, why: string) => db.prepare('INSERT INTO login_log(email,ip,ok,reason) VALUES(?,?,?,?)').run(email, addr, okk, why);
  if (!ipAllowed(addr)) { log(0, 'IP blocked'); return bad('Login is not allowed from this network (IP ' + addr + '). Ask the Super Admin to approve it.'); }
  const u = db.prepare('SELECT * FROM users WHERE lower(email)=?').get(email) as any;
  const max = Number((db.prepare("SELECT value FROM settings WHERE key='max_attempts'").get() as any)?.value || 5);
  if (!u || !u.can_login || !u.active) { log(0, 'unknown'); return bad('Email or password is incorrect.'); }
  if (u.locked) { log(0, 'locked'); return bad('Account locked after too many wrong attempts. Ask the Super Admin to unlock it.'); }
  if (!u.password_hash || !bcrypt.compareSync(pass, u.password_hash)) {
    const failed = u.failed + 1; db.prepare('UPDATE users SET failed=?, locked=? WHERE id=?').run(failed, failed >= max ? 1 : 0, u.id);
    log(0, 'bad password'); return bad(failed >= max ? 'Too many wrong attempts — account locked.' : `Email or password is incorrect. ${max - failed} attempt(s) left.`);
  }
  db.prepare('UPDATE users SET failed=0 WHERE id=?').run(u.id); log(1, 'ok');
  await createSession(u.id); audit({ uid: u.id, name: u.name } as any, 'auth', 'login', '', null, null, addr);
  redirect('/');
}
export async function logoutAction() { await destroySession(); redirect('/login'); }

export async function finishOnboarding() {
  const s = await requireSession(); getDb().prepare('UPDATE users SET onboarded=1 WHERE id=?').run(s.uid); revalidatePath('/');
}
export async function restartTour() { const s = await requireSession(); getDb().prepare('UPDATE users SET onboarded=0 WHERE id=?').run(s.uid); revalidatePath('/'); }

export async function saveSettings(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('settings', 'edit'); const keys = str(f, '_keys').split(',').filter(Boolean);
  for (const k of keys) setSetting(k, str(f, k));
  audit(s, 'settings', 'update', keys.join(',')); revalidatePath('/', 'layout'); return ok('Settings saved.');
}
export async function saveGoldRate(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('settings', 'edit'); const r = num(f, 'rate'); if (r <= 0) return bad('Enter the 24K rate per gram.');
  getDb().prepare('INSERT INTO gold_rates(date,rate_24k) VALUES(?,?) ON CONFLICT(date) DO UPDATE SET rate_24k=excluded.rate_24k').run(str(f, 'date') || new Date().toISOString().slice(0, 10), r);
  audit(s, 'settings', 'gold-rate', String(r)); revalidatePath('/', 'layout'); return ok('Gold rate saved.');
}

export async function saveDepartment(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('departments', 'add'); const name = str(f, 'name'); if (!name) return bad('Department name is required.');
  try { getDb().prepare('INSERT INTO departments(name,head) VALUES(?,?)').run(name, str(f, 'head')); } catch { return bad('A department with this name already exists.'); }
  audit(s, 'departments', 'create', name); revalidatePath('/departments'); return ok('Department added.');
}
export async function deleteDepartment(f: FormData) {
  const s = await guard('departments', 'delete'); const id = int(f, 'id'); const used = getDb().prepare('SELECT COUNT(*) c FROM order_stages WHERE dept_id=?').get(id) as any;
  if (used.c) getDb().prepare('UPDATE departments SET active=0 WHERE id=?').run(id); else getDb().prepare('DELETE FROM departments WHERE id=?').run(id);
  audit(s, 'departments', 'delete', String(id)); revalidatePath('/departments');
}

export async function saveKarigar(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('karigars', 'add'); const name = str(f, 'name'); if (!name) return bad('Name is required.');
  const email = str(f, 'email').toLowerCase() || null; const pw = str(f, 'password');
  const roleId = (getDb().prepare("SELECT id FROM roles WHERE name='Karigar'").get() as any).id;
  try {
    getDb().prepare('INSERT INTO users(name,mobile,email,password_hash,role_id,dept_id,kind,wage_type,wage_rate,can_login) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(name, str(f, 'mobile'), email, pw ? bcrypt.hashSync(pw, 10) : null, roleId, int(f, 'dept_id') || null, 'karigar', str(f, 'wage_type') || 'per_gram', num(f, 'wage_rate'), email && pw ? 1 : 0);
  } catch { return bad('That email is already used.'); }
  audit(s, 'karigars', 'create', name); revalidatePath('/karigars'); return ok('Karigar added.');
}

export async function saveUser(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('users', 'add'); const name = str(f, 'name'), email = str(f, 'email').toLowerCase(), pw = str(f, 'password');
  if (!name || !email || pw.length < 8) return bad('Name, email and a password of at least 8 characters are required.');
  try {
    getDb().prepare('INSERT INTO users(name,mobile,email,password_hash,role_id,dept_id,kind) VALUES(?,?,?,?,?,?,?)').run(name, str(f, 'mobile'), email, bcrypt.hashSync(pw, 10), int(f, 'role_id'), int(f, 'dept_id') || null, 'staff');
  } catch { return bad('That email is already used.'); }
  audit(s, 'users', 'create', email); revalidatePath('/users'); return ok('User created.');
}
export async function userToggle(f: FormData) {
  const s = await guard('users', 'edit'); const id = int(f, 'id'); const what = str(f, 'what');
  if (what === 'unlock') getDb().prepare('UPDATE users SET locked=0, failed=0 WHERE id=?').run(id);
  if (what === 'block') getDb().prepare('UPDATE users SET active=1-active WHERE id=?').run(id);
  audit(s, 'users', what, String(id)); revalidatePath('/users');
}
export async function createRole(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('users', 'add'); const name = str(f, 'name'); if (!name) return bad('Role name is required.');
  try { getDb().prepare('INSERT INTO roles(name) VALUES(?)').run(name); } catch { return bad('Role already exists.'); }
  audit(s, 'users', 'role-create', name); revalidatePath('/users'); return ok('Role created — now tick its permissions below.');
}
export async function savePerms(f: FormData) {
  const s = await guard('users', 'edit'); const rid = int(f, 'role_id'); const db = getDb();
  const role = db.prepare('SELECT is_super FROM roles WHERE id=?').get(rid) as any; if (role?.is_super) return;
  const old = db.prepare('SELECT * FROM role_perms WHERE role_id=?').all(rid);
  db.transaction(() => {
    db.prepare('DELETE FROM role_perms WHERE role_id=?').run(rid);
    for (const m of MODULES) {
      const v = (k: string) => (f.get(`${m}.${k}`) ? 1 : 0);
      if (v('view') || v('add') || v('edit') || v('delete')) db.prepare('INSERT INTO role_perms VALUES(?,?,?,?,?,?)').run(rid, m, v('view') || 1, v('add'), v('edit'), v('delete'));
    }
  })();
  audit(s, 'users', 'perms', String(rid), old, null); revalidatePath('/users');
}
export async function addIp(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('users', 'edit'); const v = str(f, 'ip'); if (!v) return bad('Enter an IP address.');
  getDb().prepare('INSERT INTO ip_rules(ip,label) VALUES(?,?)').run(v, str(f, 'label')); audit(s, 'users', 'ip-add', v); revalidatePath('/users'); return ok('IP approved.');
}
export async function delIp(f: FormData) { const s = await guard('users', 'edit'); getDb().prepare('DELETE FROM ip_rules WHERE id=?').run(int(f, 'id')); audit(s, 'users', 'ip-del'); revalidatePath('/users'); }

export async function saveJewel(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('jewels', 'add'); const name = str(f, 'name'); const flow = str(f, 'flow').split(',').filter(Boolean).map(Number);
  if (!name) return bad('Jewel name is required.'); if (!flow.length) return bad('Pick at least one department for the flow.');
  const id = int(f, 'id');
  try {
    if (id) getDb().prepare('UPDATE jewel_types SET name=?, flow=? WHERE id=?').run(name, JSON.stringify(flow), id);
    else getDb().prepare('INSERT INTO jewel_types(name,flow) VALUES(?,?)').run(name, JSON.stringify(flow));
  } catch { return bad('A jewel with this name exists.'); }
  audit(s, 'jewels', id ? 'update' : 'create', name); revalidatePath('/jewels'); return ok('Jewel flow saved.');
}

export async function saveDesign(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('designs', 'add'); const code = str(f, 'code'); if (!code) return bad('Design code is required.');
  try { getDb().prepare('INSERT INTO designs(code,title,category,weight,image) VALUES(?,?,?,?,?)').run(code, str(f, 'title'), str(f, 'category'), num(f, 'weight'), str(f, 'image')); } catch { return bad('Design code exists.'); }
  audit(s, 'designs', 'create', code); revalidatePath('/designs'); return ok('Design added.');
}
export async function toggleDesign(f: FormData) { const s = await guard('designs', 'edit'); getDb().prepare('UPDATE designs SET visible=1-visible WHERE id=?').run(int(f, 'id')); audit(s, 'designs', 'toggle'); revalidatePath('/designs'); }
export async function logDesignEvent(designId: number, event: string) { const s = await requireSession(); getDb().prepare('INSERT INTO design_views(user_id,design_id,event) VALUES(?,?,?)').run(s.uid, designId, event); }

export async function sendChat(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('chat', 'add'); const body = str(f, 'body'); if (!body) return bad('Type a message.');
  getDb().prepare('INSERT INTO chat_messages(from_user,to_user,body) VALUES(?,?,?)').run(s.uid, int(f, 'to_user') || null, body); revalidatePath('/chat'); return ok('Sent');
}

export async function setDesignAccess(f: FormData) {
  const s = await guard('designs', 'edit'); const id = int(f, 'design_id'); const db = getDb();
  db.transaction(() => { db.prepare('DELETE FROM design_access WHERE design_id=?').run(id); for (const v of f.getAll('party')) db.prepare('INSERT INTO design_access VALUES(?,?)').run(id, Number(v)); })();
  audit(s, 'designs', 'access', String(id)); revalidatePath('/designs');
}

export async function toggleBlockParty(f: FormData) {
  const s = await guard('designs', 'edit'); const id = int(f, 'party_id'); const db = getDb();
  if (db.prepare('SELECT 1 FROM blocked_parties WHERE party_id=?').get(id)) db.prepare('DELETE FROM blocked_parties WHERE party_id=?').run(id);
  else db.prepare('INSERT INTO blocked_parties VALUES(?,?)').run(id, 'Blocked after protection alert');
  audit(s, 'designs', 'block-toggle', String(id)); revalidatePath('/designs');
}
export async function sendPartyChat(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('chat', 'add'); const body = str(f, 'body'); const pid = int(f, 'party_id'); if (!body || !pid) return bad('Type a message.');
  getDb().prepare('INSERT INTO chat_messages(from_user,party_id,from_party,body) VALUES(?,?,0,?)').run(s.uid, pid, body); revalidatePath('/chat'); return ok('Sent');
}
