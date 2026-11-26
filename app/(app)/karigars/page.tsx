import Link from 'next/link';
import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { g3 } from '@/lib/gold';
import { saveKarigar } from '@/actions/core';
import { ActionForm, Field } from '@/components/Form';
import { Card, PageHeader, Table, Td, Empty } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function Karigars({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const s = await guard('karigars'); const p = permOf(s, 'karigars'); const db = getDb(); const { id } = await searchParams;
  const rows = db.prepare(`SELECT u.*, d.name dept, COALESCE((SELECT SUM(CASE dir WHEN 'IN' THEN gross ELSE -gross END) FROM gold_ledger WHERE acct_type='karigar' AND acct_id=u.id),0) gross,
    COALESCE((SELECT SUM(CASE dir WHEN 'IN' THEN fine ELSE -fine END) FROM gold_ledger WHERE acct_type='karigar' AND acct_id=u.id),0) fine,
    COALESCE((SELECT SUM(loss_fine) FROM loss_entries WHERE karigar_id=u.id),0) loss FROM users u LEFT JOIN departments d ON d.id=u.dept_id WHERE u.kind='karigar' AND u.active=1 ORDER BY u.name`).all() as any[];
  const depts = db.prepare('SELECT id,name FROM departments WHERE active=1').all() as any[];
  const sel = id ? rows.find((r) => r.id === Number(id)) : null;
  const stmt = sel ? db.prepare("SELECT * FROM gold_ledger WHERE acct_type='karigar' AND acct_id=? ORDER BY date DESC,id DESC LIMIT 60").all(sel.id) as any[] : [];
  return (
    <>
      <PageHeader title="Karigars" subtitle="Workers, their gold balance and loss" id="karigars" help={{ steps: ['Add a karigar with department and wage type (per gram / per piece).', 'The “Gold with karigar” column is gross and fine gold currently in their hands.', 'Click a name to see the date-wise gold statement.'], tip: 'Gold reaches a karigar through Metal Transfer — it is not typed here.' }} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card pad={false}>{rows.length ? <Table head={['Karigar', 'Department', 'Wage', 'Gold with karigar', 'Fine', 'Total loss (fine)']} right={[3, 4, 5]}>
            {rows.map((k) => (<tr key={k.id} className={sel?.id === k.id ? 'bg-brand-50/50' : ''}><Td className="font-semibold"><Link className="text-brand-600" href={`/karigars?id=${k.id}`}>{k.name}</Link><div className="text-xs font-normal text-slate-400">{k.mobile}</div></Td><Td>{k.dept || '—'}</Td><Td>₹{k.wage_rate}/{k.wage_type === 'per_gram' ? 'g' : 'pc'}</Td><Td right>{g3(k.gross)} g</Td><Td right>{g3(k.fine)} g</Td><Td right className="text-rose-600">{g3(k.loss)} g</Td></tr>))}
          </Table> : <Empty title="No karigars yet" hint="Add your first karigar." />}</Card>
          {sel && <Card title={`Gold statement — ${sel.name}`} pad={false}><Table head={['Date', 'Narration', 'In (g)', 'Out (g)', 'Touch', 'Fine']} right={[2, 3, 4, 5]}>
            {stmt.map((r) => (<tr key={r.id}><Td>{r.date}</Td><Td>{r.narration}</Td><Td right>{r.dir === 'IN' ? g3(r.gross) : ''}</Td><Td right>{r.dir === 'OUT' ? g3(r.gross) : ''}</Td><Td right>{r.touch}</Td><Td right className={r.dir === 'IN' ? 'text-leaf-600' : 'text-rose-600'}>{r.dir === 'IN' ? '+' : '−'}{g3(r.fine)}</Td></tr>))}</Table></Card>}
        </div>
        {p.can_add ? <Card title="Add karigar"><ActionForm action={saveKarigar} submit="Add karigar"><div className="space-y-3">
          <Field label="Name"><input name="name" className="input" required /></Field><Field label="Mobile"><input name="mobile" className="input" inputMode="tel" /></Field>
          <Field label="Department"><select name="dept_id" className="input"><option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Wage type"><select name="wage_type" className="input"><option value="per_gram">Per gram</option><option value="per_piece">Per piece</option></select></Field><Field label="Rate ₹"><input name="wage_rate" type="number" step="0.01" className="input" /></Field></div>
          <details className="rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Allow web login (optional)</summary><div className="mt-3 space-y-3"><Field label="Email"><input name="email" type="email" className="input" /></Field><Field label="Password (min 8)"><input name="password" type="password" className="input" /></Field></div></details>
        </div></ActionForm></Card> : null}
      </div>
    </>
  );
}
