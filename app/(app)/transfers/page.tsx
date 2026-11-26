import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createTransfer, confirmTransfer } from '@/actions/ops';
import { ActionForm, Field } from '@/components/Form';
import { Badge, Card, PageHeader, Table, Td, Empty } from '@/components/ui';
import { g3 } from '@/lib/gold';
import { accounts } from '@/lib/accounts';
export const dynamic = 'force-dynamic';

const label = (acc: { v: string; l: string }[], t: string, i: number) => acc.find((a) => a.v === `${t}:${i}`)?.l || `${t}:${i}`;

export default async function Transfers() {
  const s = await guard('transfers'); const p = permOf(s, 'transfers'); const db = getDb(); const acc = accounts();
  const rows = db.prepare('SELECT t.*, u.name by_name FROM transfers t LEFT JOIN users u ON u.id=t.by_user ORDER BY t.id DESC LIMIT 100').all() as any[];
  const orders = db.prepare("SELECT id,no FROM orders WHERE status IN ('New','In Process')").all() as any[];
  return (
    <>
      <PageHeader title="Gold / Metal Transfer" subtitle="Store → department → karigar → next department" id="transfers" help={{ steps: ['Pick where the gold is coming FROM and going TO, then weight and touch. Fine gold is calculated for you.', 'The sender’s balance reduces immediately. The transfer shows “Pending” until the receiver presses Confirm.', 'Only after confirmation does the receiver’s balance increase — so there is never any “I never got it” confusion.'], tip: 'The system blocks a transfer if the sender does not hold enough gold.' }} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card pad={false} className="xl:col-span-2">
          {rows.length ? <Table head={['Date', 'From → To', 'Gross', 'Touch', 'Fine', 'Status', '']} right={[2, 3, 4]}>
            {rows.map((t) => (<tr key={t.id}><Td>{t.date}</Td><Td className="font-medium">{label(acc, t.from_type, t.from_id)}<span className="mx-1 text-slate-300">→</span>{label(acc, t.to_type, t.to_id)}<div className="text-xs font-normal text-slate-400">by {t.by_name}{t.note ? ` · ${t.note}` : ''}</div></Td><Td right>{g3(t.gross)} g</Td><Td right>{t.touch}</Td><Td right className="font-bold text-amber-700">{g3(t.fine)} g</Td><Td><Badge>{t.status}</Badge></Td>
              <Td right>{t.status === 'Pending' && p.can_edit ? <form action={confirmTransfer}><input type="hidden" name="id" value={t.id} /><button className="btn-green !py-1.5">Confirm receipt</button></form> : null}</Td></tr>))}
          </Table> : <Empty title="No transfers yet" hint="Issue gold from the store to a department to begin." />}
        </Card>
        {p.can_add ? <Card title="New transfer"><ActionForm action={createTransfer} submit="Send gold"><div className="space-y-3">
          <Field label="From"><select name="from" className="input" required>{acc.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field>
          <Field label="To"><select name="to" className="input" required><option value="">Select…</option>{acc.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Gross (g)"><input name="gross" type="number" step="0.001" className="input num" required /></Field><Field label="Touch %"><input name="touch" type="number" step="0.01" defaultValue="91.6" className="input num" /></Field></div>
          <Field label="For order (optional)"><select name="order_id" className="input"><option value="">—</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.no}</option>)}</select></Field>
          <Field label="Date"><input name="date" type="date" className="input" /></Field><Field label="Note"><input name="note" className="input" /></Field>
        </div></ActionForm></Card> : null}
      </div>
    </>
  );
}
