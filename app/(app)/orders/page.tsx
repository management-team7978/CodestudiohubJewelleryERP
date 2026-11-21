import Link from 'next/link';
import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { createOrder } from '@/actions/ops';
import { ActionForm, Field } from '@/components/Form';
import { Badge, Card, Empty, PageHeader, Table, Td } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function Orders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await guard('orders'); const p = permOf(s, 'orders'); const db = getDb(); const { status } = await searchParams;
  const rows = db.prepare(`SELECT o.*, p.name party, j.name jewel, (SELECT d.name FROM order_stages st JOIN departments d ON d.id=st.dept_id WHERE st.order_id=o.id AND st.status='Active') dept,
    (SELECT COUNT(*) FROM order_stages WHERE order_id=o.id) total, (SELECT COUNT(*) FROM order_stages WHERE order_id=o.id AND status='Done') done
    FROM orders o JOIN parties p ON p.id=o.party_id JOIN jewel_types j ON j.id=o.jewel_type_id ${status ? 'WHERE o.status=?' : ''} ORDER BY o.id DESC`).all(...(status ? [status] : [])) as any[];
  const parties = db.prepare("SELECT id,name,type FROM parties WHERE active=1 AND type!='SUPPLIER'").all() as any[]; const jewels = db.prepare('SELECT id,name FROM jewel_types').all() as any[];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Orders" subtitle="B2B and B2C orders with live department tracking" id="orders" help={{ steps: ['Create an order on the right: choose customer, jewel, weight, due date. If the customer gave gold, enter weight + touch — fine gold is credited to their ledger automatically.', 'Click an order number to see exactly which department it is in, and move it forward.', 'Red due dates mean the order is delayed.'] }}>
        {['', 'New', 'In Process', 'Ready', 'Delivered'].map((st) => <Link key={st} href={st ? `/orders?status=${encodeURIComponent(st)}` : '/orders'} className={`chip !px-3 !py-1.5 ${(status || '') === st ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{st || 'All'}</Link>)}
      </PageHeader>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card pad={false} className="xl:col-span-2">
          {rows.length ? <Table head={['Order', 'Customer', 'Jewel', 'Wt (g)', 'Where now', 'Progress', 'Due', 'Status']} right={[3]}>
            {rows.map((o) => (<tr key={o.id} className="hover:bg-slate-50/60"><Td className="font-bold"><Link href={`/orders/${o.id}`} className="text-brand-600">{o.no}</Link></Td><Td>{o.party}<div className="text-xs text-slate-400">{o.kind}</div></Td><Td>{o.jewel}<div className="text-xs text-slate-400">{o.design}</div></Td><Td right>{o.weight}</Td><Td>{o.dept || (o.status === 'Ready' || o.status === 'Delivered' ? 'Complete' : 'Not started')}</Td>
              <Td><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-leaf-500" style={{ width: `${o.total ? (o.done / o.total) * 100 : 0}%` }} /></div></Td>
              <Td className={o.due_date && o.due_date < today && !['Delivered', 'Cancelled'].includes(o.status) ? 'font-bold text-rose-600' : ''}>{o.due_date || '—'}</Td><Td><Badge>{o.status}</Badge></Td></tr>))}
          </Table> : <Empty title="No orders here" hint="Create your first order using the form." />}
        </Card>
        {p.can_add ? <Card title="New order"><ActionForm action={createOrder} submit="Create order"><div className="grid grid-cols-2 gap-3">
          <Field label="Customer" className="col-span-2"><select name="party_id" className="input" required><option value="">Select…</option>{parties.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.type})</option>)}</select></Field>
          <Field label="Jewel"><select name="jewel_type_id" className="input" required><option value="">Select…</option>{jewels.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Design code"><input name="design" className="input" /></Field>
          <Field label="Purity"><select name="purity" className="input"><option>24K</option><option selected>22K</option><option>20K</option><option>18K</option><option>14K</option></select></Field>
          <Field label="Weight (g)"><input name="weight" type="number" step="0.001" className="input num" /></Field>
          <Field label="Qty"><input name="qty" type="number" defaultValue={1} className="input" /></Field><Field label="Size"><input name="size" className="input" /></Field>
          <Field label="Due date" className="col-span-2"><input name="due_date" type="date" className="input" /></Field>
          <div className="col-span-2 rounded-xl bg-amber-50 p-3"><p className="mb-2 text-xs font-bold uppercase text-amber-700">Gold received from customer (optional)</p><div className="grid grid-cols-2 gap-3"><input name="gold_gross" type="number" step="0.001" placeholder="Weight g" className="input num" /><input name="gold_touch" type="number" step="0.01" placeholder="Touch e.g. 75" className="input num" /></div></div>
          <Field label="Remarks" className="col-span-2"><input name="remarks" className="input" /></Field>
        </div></ActionForm></Card> : null}
      </div>
    </>
  );
}
