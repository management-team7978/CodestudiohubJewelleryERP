import Link from 'next/link';
import { guard } from '@/lib/auth';
import { getDb, todayStr } from '@/lib/db';
import { g3, inr } from '@/lib/gold';
import { PageHeader, Card, Stat, Badge, Table, Td } from '@/components/ui';
import { TrendChart, BarCompare } from '@/components/Charts';
import { PackageCheck, Coins, TrendingDown, Wallet, AlertTriangle, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  const s = await guard('dashboard'); const db = getDb(); const q = (sql: string, ...a: any[]) => db.prepare(sql).get(...a) as any; const all = (sql: string, ...a: any[]) => db.prepare(sql).all(...a) as any[];
  const t = todayStr(); const m = t.slice(0, 7);
  const orders = all("SELECT status, COUNT(*) c FROM orders GROUP BY status"); const oc = (st: string) => orders.find((o) => o.status === st)?.c || 0;
  const store = q("SELECT COALESCE(SUM(CASE dir WHEN 'IN' THEN fine ELSE -fine END),0) f, COALESCE(SUM(CASE dir WHEN 'IN' THEN gross ELSE -gross END),0) g FROM gold_ledger WHERE acct_type='store'");
  const kar = q("SELECT COALESCE(SUM(CASE dir WHEN 'IN' THEN fine ELSE -fine END),0) f FROM gold_ledger WHERE acct_type='karigar'");
  const deptGold = all("SELECT d.name n, ROUND(COALESCE(SUM(CASE g.dir WHEN 'IN' THEN g.fine ELSE -g.fine END),0),3) v FROM departments d LEFT JOIN gold_ledger g ON g.acct_type='dept' AND g.acct_id=d.id WHERE d.active=1 GROUP BY d.id HAVING v<>0");
  const lossToday = q('SELECT COALESCE(SUM(loss_fine),0) v FROM loss_entries WHERE date=?', t).v; const lossMonth = q('SELECT COALESCE(SUM(loss_fine),0) v FROM loss_entries WHERE substr(date,1,7)=?', m).v;
  const trend = all("SELECT substr(date,6) l, ROUND(SUM(loss_fine),3) v FROM loss_entries WHERE date>=date('now','-14 day') GROUP BY date ORDER BY date");
  const cashDue = q('SELECT COALESCE(SUM(debit-credit),0) v FROM cash_ledger').v;
  const goldDue = q("SELECT COALESCE(SUM(CASE WHEN b<0 THEN -b ELSE 0 END),0) v FROM (SELECT SUM(CASE dir WHEN 'IN' THEN fine ELSE -fine END) b FROM gold_ledger WHERE acct_type='party' GROUP BY acct_id)").v;
  const inDept = all("SELECT d.name n, COUNT(*) v FROM order_stages s JOIN departments d ON d.id=s.dept_id WHERE s.status='Active' GROUP BY d.id");
  const recent = all('SELECT o.id,o.no,o.status,o.due_date,p.name party,j.name jewel FROM orders o JOIN parties p ON p.id=o.party_id JOIN jewel_types j ON j.id=o.jewel_type_id ORDER BY o.id DESC LIMIT 6');
  const pays = all('SELECT r.no,r.date,r.mode,r.amount,r.fine,p.name party FROM receipts r JOIN parties p ON p.id=r.party_id ORDER BY r.id DESC LIMIT 5');
  const delayed = all("SELECT no,due_date FROM orders WHERE status IN ('New','In Process') AND due_date<>'' AND due_date<? ", t);
  const low = all("SELECT i.name, ROUND(COALESCE(SUM(CASE t.kind WHEN 'IN' THEN t.qty WHEN 'OUT' THEN -t.qty ELSE t.qty END),0),2) s, i.min_stock m FROM items i LEFT JOIN stock_txn t ON t.item_id=i.id GROUP BY i.id HAVING s<m");
  const pend = q("SELECT COUNT(*) c FROM transfers WHERE status='Pending'").c;
  const alerts = [...delayed.map((d) => `Order ${d.no} is overdue (due ${d.due_date})`), ...low.map((l) => `Low stock: ${l.name} (${l.s} < ${l.m})`), ...(pend ? [`${pend} transfer(s) waiting for confirmation`] : [])];
  return (
    <>
      <PageHeader title={`Hello, ${s.name.split(' ')[0]} 👋`} subtitle="Here’s what’s happening in your factory today." id="dashboard"
        help={{ steps: ['The cards on top show gold in stock, gold with karigars, loss and money to collect.', 'The red/green line shows daily loss — going down is good.', 'Use the left menu to create an order, book loss or make a bill.'], tip: 'New here? Open “Getting Started” in the menu for a 5-step setup checklist.' }}>
        <Link href="/orders" className="btn-primary">+ New order</Link><Link href="/loss" className="btn-ghost">Book loss</Link>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open orders" value={String(oc('New') + oc('In Process'))} sub={`${oc('Ready')} ready · ${oc('Delivered')} delivered`} icon={<PackageCheck />} />
        <Stat label="Gold in store (fine)" value={g3(store.f) + ' g'} sub={`Gross ${g3(store.g)} g · karigars hold ${g3(kar.f)} g fine`} tone="gold" icon={<Coins />} />
        <Stat label="Loss today / month" value={g3(lossToday) + ' g'} sub={`This month ${g3(lossMonth)} g fine`} tone="rose" icon={<TrendingDown />} />
        <Stat label="To collect" value={inr(cashDue)} sub={`+ ${g3(goldDue)} g fine gold`} tone="leaf" icon={<Wallet />} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Loss trend — last 14 days (g fine)" className="lg:col-span-2">{trend.length ? <TrendChart data={trend} /> : <p className="py-10 text-center text-sm text-slate-400">No loss booked yet.</p>}</Card>
        <Card title="Alerts" action={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          {alerts.length ? <ul className="space-y-2">{alerts.map((a, i) => <li key={i} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{a}</li>)}</ul> : <p className="py-6 text-center text-sm text-slate-400">All clear ✅</p>}
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Orders in each department (live)">{inDept.length ? <BarCompare data={inDept.map((d) => ({ l: d.n, v: d.v }))} name="Orders" /> : <p className="py-10 text-center text-sm text-slate-400">No active orders.</p>}</Card>
        <Card title="Gold in each department (fine g)">{deptGold.length ? <BarCompare data={deptGold.map((d) => ({ l: d.n, v: d.v }))} name="Fine g" /> : <p className="py-10 text-center text-sm text-slate-400">No gold issued to departments yet. Use Metal Transfer.</p>}</Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Recent orders" pad={false} action={<Link className="text-sm font-semibold text-brand-600" href="/orders">View all</Link>}>
          <Table head={['Order', 'Customer', 'Jewel', 'Status']}>{recent.map((o) => (<tr key={o.id}><Td className="font-semibold"><Link href={`/orders/${o.id}`} className="text-brand-600">{o.no}</Link></Td><Td>{o.party}</Td><Td>{o.jewel}</Td><Td><Badge>{o.status}</Badge></Td></tr>))}</Table>
        </Card>
        <Card title="Recent payments" pad={false}>
          {pays.length ? <Table head={['Receipt', 'Party', 'Mode', 'Received']} right={[3]}>{pays.map((p) => (<tr key={p.no}><Td className="font-semibold">{p.no}</Td><Td>{p.party}</Td><Td>{p.mode}</Td><Td right>{p.mode === 'GOLD' ? g3(p.fine) + ' g fine' : inr(p.amount)}</Td></tr>))}</Table> : <p className="py-10 text-center text-sm text-slate-400">No receipts yet.</p>}
        </Card>
      </div>
    </>
  );
}
