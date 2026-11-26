import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { advanceOrder, setOrderStatus } from '@/actions/ops';
import { ActionForm, Field } from '@/components/Form';
import { Badge, Card, PageHeader, Table, Td } from '@/components/ui';
import { g3, inr } from '@/lib/gold';
import { Check, Circle, Loader } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await guard('orders'); const p = permOf(s, 'orders'); const { id } = await params; const db = getDb();
  const o = db.prepare('SELECT o.*, p.name party, p.mobile, j.name jewel FROM orders o JOIN parties p ON p.id=o.party_id JOIN jewel_types j ON j.id=o.jewel_type_id WHERE o.id=?').get(id) as any; if (!o) notFound();
  const stages = db.prepare('SELECT st.*, d.name dept, u.name karigar FROM order_stages st JOIN departments d ON d.id=st.dept_id LEFT JOIN users u ON u.id=st.karigar_id WHERE order_id=? ORDER BY seq').all(id) as any[];
  const kars = db.prepare("SELECT id,name,dept_id FROM users WHERE kind='karigar' AND active=1").all() as any[];
  const cur = stages.find((x) => x.status === 'Active') || stages.find((x) => x.status === 'Pending');
  const loss = db.prepare('SELECT COALESCE(SUM(loss_gross),0) g, COALESCE(SUM(loss_fine),0) f, COALESCE(SUM(weight_given),0) w FROM loss_entries WHERE order_id=?').get(id) as any;
  const bills = db.prepare('SELECT id,no,type,total FROM invoices WHERE order_id=?').all(id) as any[];
  return (
    <>
      <PageHeader title={o.no} subtitle={`${o.jewel} · ${o.party} · ${o.weight} g · ${o.purity}`} id="order-detail" help={{ steps: ['The timeline shows every department the order has to visit.', 'When a department starts work, press “Start here”, choose the karigar. When they finish, enter the weight coming out and press “Complete & move on”.', 'Weight in vs out per department helps you spot where gold is lost.'] }}>
        <Badge>{o.status}</Badge>{p.can_edit && o.status === 'Ready' && <form action={setOrderStatus}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="Delivered" /><button className="btn-green">Mark delivered</button></form>}
        {p.can_edit && !['Delivered', 'Cancelled'].includes(o.status) && <form action={setOrderStatus}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value="Cancelled" /><button className="btn-danger">Cancel</button></form>}
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Department tracking" className="lg:col-span-2">
          <ol className="relative ml-4 space-y-5 border-l-2 border-slate-100 pl-6">
            {stages.map((st) => (
              <li key={st.id} className="relative">
                <span className={`absolute -left-10 grid h-8 w-8 place-items-center rounded-full ring-4 ring-white ${st.status === 'Done' ? 'bg-leaf-500 text-white' : st.status === 'Active' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{st.status === 'Done' ? <Check className="h-4 w-4" /> : st.status === 'Active' ? <Loader className="h-4 w-4 animate-spin" /> : <Circle className="h-3 w-3" />}</span>
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-ink-800">{st.dept}</p><Badge>{st.status}</Badge></div>
                <p className="mt-0.5 text-sm text-slate-500">{st.karigar ? `Karigar: ${st.karigar} · ` : ''}{st.started_at ? `In: ${g3(st.weight_in)} g (${st.started_at})` : 'Waiting'}{st.finished_at ? ` · Out: ${g3(st.weight_out)} g (${st.finished_at}) · diff ${g3(st.weight_in - st.weight_out)} g` : ''}</p>
              </li>))}
          </ol>
          {p.can_edit && cur && (
            <div className="mt-6 rounded-2xl bg-brand-50/60 p-4"><p className="mb-3 text-sm font-bold text-brand-800">{cur.status === 'Pending' ? `Start ${cur.dept}` : `Finish ${cur.dept}`}</p>
              <ActionForm action={advanceOrder} submit={cur.status === 'Pending' ? 'Start here' : 'Complete & move on'} tone={cur.status === 'Pending' ? 'primary' : 'green'}>
                <input type="hidden" name="order_id" value={o.id} /><div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Karigar"><select name="karigar_id" className="input" defaultValue={cur.karigar_id || ''}><option value="">—</option>{kars.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></Field>
                  {cur.status === 'Pending' ? <Field label="Weight in (g)"><input name="weight_in" type="number" step="0.001" className="input num" defaultValue={o.weight} /></Field> : <Field label="Weight out (g)"><input name="weight_out" type="number" step="0.001" className="input num" defaultValue={cur.weight_in} /></Field>}
                </div></ActionForm></div>)}
        </Card>
        <div className="space-y-6">
          <Card title="Order details"><dl className="space-y-2 text-sm">{[['Customer', o.party], ['Mobile', o.mobile], ['Type', o.kind], ['Design', o.design || '—'], ['Qty / size', `${o.qty} / ${o.size || '—'}`], ['Due', o.due_date || '—'], ['Gold received', g3(o.gold_received) + ' g'], ['Remarks', o.remarks || '—']].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 break-words text-right font-semibold">{v}</dd></div>)}</dl></Card>
          <Card title="Loss card"><div className="grid grid-cols-2 gap-3 text-center"><div className="rounded-xl bg-rose-50 p-3"><p className="num text-xl font-extrabold text-rose-600">{g3(loss.g)} g</p><p className="text-xs text-slate-500">Loss gross</p></div><div className="rounded-xl bg-amber-50 p-3"><p className="num text-xl font-extrabold text-amber-700">{g3(loss.f)} g</p><p className="text-xs text-slate-500">Loss fine</p></div></div><p className="mt-3 text-center text-sm text-slate-500">Loss % = {loss.w ? ((loss.g / loss.w) * 100).toFixed(2) : '0.00'}% of gold issued</p></Card>
          <Card title="Bills">{bills.length ? <ul className="space-y-2 text-sm">{bills.map((b) => <li key={b.id} className="flex justify-between"><Link className="font-semibold text-brand-600" href={`/billing/${b.id}`}>{b.no}</Link><span>{b.type} · {inr(b.total)}</span></li>)}</ul> : <p className="text-sm text-slate-400">No bill yet. Create one in Billing.</p>}</Card>
        </div>
      </div>
    </>
  );
}
