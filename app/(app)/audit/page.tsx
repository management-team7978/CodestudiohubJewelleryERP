import { guard } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { Card, PageHeader, Table, Td } from '@/components/ui';
import { Field } from '@/components/Form';
export const dynamic = 'force-dynamic';

export default async function Audit({ searchParams }: { searchParams: Promise<{ module?: string; user?: string; from?: string }> }) {
  await guard('audit'); const db = getDb(); const sp = await searchParams; const cond: string[] = []; const a: any[] = [];
  if (sp.module) { cond.push('module=?'); a.push(sp.module); } if (sp.user) { cond.push('user_name LIKE ?'); a.push(`%${sp.user}%`); } if (sp.from) { cond.push('at>=?'); a.push(sp.from); }
  const rows = db.prepare(`SELECT * FROM audit_log ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`).all(...a) as any[];
  const mods = db.prepare('SELECT DISTINCT module FROM audit_log').all() as any[];
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Who did what, and when" id="audit" help={{ steps: ['Every create, edit, delete, login, export and permission change is recorded here.', 'Filter by module, user or date to investigate.'] }} />
      <form className="no-print mb-4 flex flex-wrap items-end gap-3"><Field label="Module"><select name="module" defaultValue={sp.module || ''} className="input"><option value="">All</option>{mods.map((m) => <option key={m.module}>{m.module}</option>)}</select></Field><Field label="User"><input name="user" defaultValue={sp.user} className="input" /></Field><Field label="From"><input type="date" name="from" defaultValue={sp.from} className="input" /></Field><button className="btn-primary">Filter</button></form>
      <Card pad={false}><Table head={['When', 'User', 'Module', 'Action', 'Reference', 'IP']}>{rows.map((r) => <tr key={r.id}><Td className="whitespace-nowrap">{r.at}</Td><Td className="font-semibold">{r.user_name}</Td><Td>{r.module}</Td><Td><span className="chip bg-slate-100 text-slate-700">{r.action}</span></Td><Td className="max-w-xs truncate text-slate-500">{r.ref}</Td><Td className="text-slate-400">{r.ip}</Td></tr>)}</Table></Card>
    </>
  );
}
