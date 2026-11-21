import { getDb } from './db';
export function accounts() {
  const db = getDb();
  return [{ v: 'store:0', l: '🔒 Main Store / Locker' },
    ...(db.prepare('SELECT id,name FROM departments WHERE active=1').all() as any[]).map((d) => ({ v: `dept:${d.id}`, l: `🏭 ${d.name}` })),
    ...(db.prepare("SELECT id,name FROM users WHERE kind='karigar' AND active=1").all() as any[]).map((d) => ({ v: `karigar:${d.id}`, l: `👷 ${d.name}` })),
    ...(db.prepare('SELECT id,name FROM parties WHERE active=1').all() as any[]).map((d) => ({ v: `party:${d.id}`, l: `🤝 ${d.name}` }))];
}
