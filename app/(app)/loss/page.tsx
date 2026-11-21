import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { bookLoss } from '@/actions/ops';
import { ActionForm, Field } from '@/components/Form';
import { Card, PageHeader, Stat, Table, Td } from '@/components/ui';
import { BarCompare, PieShare, TrendChart } from '@/components/Charts';
import { g3 } from '@/lib/gold';
import { TrendingDown, TrendingUp, Download } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function Loss({ searchParams }: { searchParams: Promise<{ days?: string; dept?: string; karigar?: string }> }) {
  const s = await guard('loss'); const p = permOf(s, 'loss'); const db = getDb(); const sp = await searchParams;
  const days = Number(sp.days || 30); const dept = Number(sp.dept || 0), kar = Number(sp.karigar || 0);
  const w = `date>=date('now','-${days} day')${dept ? ` AND dept_id=${dept}` : ''}${kar ? ` AND karigar_id=${kar}` : ''}`;
  const all = (sql: string) => db.prepare(sql).all() as any[]; const one = (sql: string) => db.prepare(sql).get() as any;
  const cur = one(`SELECT COALESCE(SUM(loss_fine),0) f, COALESCE(SUM(loss_gross),0) g, COALESCE(SUM(weight_given),0) w FROM loss_entries WHERE ${w}`);
  const prev = one(`SELECT COALESCE(SUM(loss_fine),0) f FROM loss_entries WHERE date>=date('now','-${days * 2} day') AND date<date('now','-${days} day')${dept ? ` AND dept_id=${dept}` : ''}${kar ? ` AND karigar_id=${kar}` : ''}`);
  const change = prev.f ? ((cur.f - prev.f) / prev.f) * 100 : 0; const up = cur.f > prev.f;
  const trend = all(`SELECT substr(date,6) l, ROUND(SUM(loss_fine),3) v FROM loss_entries WHERE ${w} GROUP BY date ORDER BY date`);
  const byDept = all(`SELECT COALESCE(d.name,'—') l, ROUND(SUM(loss_fine),3) v FROM loss_entries l LEFT JOIN departments d ON d.id=l.dept_id WHERE ${w.replace(/date/g, 'l.date').replace(/dept_id/g, 'l.dept_id').replace(/karigar_id/g, 'l.karigar_id')} GROUP BY l.dept_id ORDER BY v DESC`);
  const byKar = all(`SELECT u.name l, ROUND(SUM(loss_fine),3) v FROM loss_entries l JOIN users u ON u.id=l.karigar_id WHERE ${w.replace(/date/g, 'l.date').replace(/dept_id/g, 'l.dept_id').replace(/karigar_id/g, 'l.karigar_id')} GROUP BY l.karigar_id ORDER BY v DESC`);
  const topOrders = all(`SELECT o.no l, ROUND(SUM(l.loss_fine),3) v, ROUND(SUM(l.loss_gross)/NULLIF(SUM(l.weight_given),0)*100,2) pct FROM loss_entries l JOIN orders o ON o.id=l.order_id WHERE ${w.replace(/date/g, 'l.date').replace(/dept_id/g, 'l.dept_id').replace(/karigar_id/g, 'l.karigar_id')} GROUP BY l.order_id ORDER BY v DESC LIMIT 5`);
  const recent = all(`SELECT l.*, d.name dept, u.name kar, o.no ono FROM loss_entries l LEFT JOIN departments d ON d.id=l.dept_id LEFT JOIN users u ON u.id=l.karigar_id LEFT JOIN orders o ON o.id=l.order_id ORDER BY l.id DESC LIMIT 12`);
  const depts = all('SELECT id,name FROM departments WHERE active=1'); const kars = all("SELECT id,name FROM users WHERE kind='karigar' AND active=1"); const orders = all('SELECT id,no FROM orders'); const jewels = all('SELECT id,name FROM jewel_types');
  return (
    <>
      <PageHeader title="Loss Booking & Analytics" subtitle="Milligram-level loss by department, karigar and order" id="loss" help={{ steps: ['Way 1 — Shift-end close: karigar returns all gold to the locker. Choose “Shift end”, enter the weight received; the difference is booked as loss and the karigar balance becomes zero.', 'Way 2 — Weigh anytime: choose “Weighing”, enter weight given and weight now. The difference is the loss.', 'Use Dust/scrap recovered to reduce the loss. Charts update at once; red = loss went up, green = went down.'], tip: 'Weights go to 3 decimals (milligram). Touch converts gross loss to FINE loss.' }}>
        <a href="/api/export/loss" className="btn-ghost"><Download className="h-4 w-4" />CSV</a>
      </PageHeader>
      <form className="no-print mb-5 flex flex-wrap items-end gap-3"><Field label="Period"><select name="days" defaultValue={days} className="input"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></Field>
        <Field label="Department"><select name="dept" defaultValue={dept} className="input"><option value="0">All</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Karigar"><select name="karigar" defaultValue={kar} className="input"><option value="0">All</option>{kars.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field><button className="btn-primary">Apply</button></form>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Loss (fine)" value={g3(cur.f) + ' g'} sub={`Gross ${g3(cur.g)} g`} tone="rose" icon={<TrendingDown />} />
        <Stat label="Loss %" value={cur.w ? ((cur.g / cur.w) * 100).toFixed(2) + '%' : '0%'} sub={`of ${g3(cur.w)} g handled`} tone="gold" icon={<TrendingDown />} />
        <Stat label="vs previous period" value={`${up ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%`} sub={up ? 'Loss increased — investigate' : 'Loss decreased — good'} tone={up ? 'rose' : 'leaf'} icon={up ? <TrendingUp /> : <TrendingDown />} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Loss trend (line)">{trend.length ? <TrendChart data={trend} /> : <p className="py-10 text-center text-sm text-slate-400">No data for this filter.</p>}</Card>
        <Card title="Department share (pie)">{byDept.length ? <PieShare data={byDept} /> : <p className="py-10 text-center text-sm text-slate-400">No data.</p>}</Card>
        <Card title="Department-wise (bar)">{byDept.length ? <BarCompare data={byDept} /> : null}</Card>
        <Card title="Karigar-wise (bar)">{byKar.length ? <BarCompare data={byKar} /> : null}</Card>
        <Card title="Top 5 highest-loss orders" pad={false}><Table head={['Order', 'Loss (fine g)', 'Loss %']} right={[1, 2]}>{topOrders.map((o) => <tr key={o.l}><Td className="font-semibold">{o.l}</Td><Td right className="text-rose-600">{g3(o.v)}</Td><Td right>{o.pct}%</Td></tr>)}</Table></Card>
        <Card title="Top karigars" pad={false}><Table head={['Karigar', 'Loss (fine g)']} right={[1]}>{byKar.slice(0, 5).map((o) => <tr key={o.l}><Td className="font-semibold">{o.l}</Td><Td right className="text-rose-600">{g3(o.v)}</Td></tr>)}</Table></Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card title="Recent loss entries" pad={false} className="xl:col-span-2"><Table head={['Date', 'Way', 'Dept', 'Karigar', 'Order', 'Given', 'Received', 'Loss g', 'Loss fine']} right={[5, 6, 7, 8]}>
          {recent.map((l) => (<tr key={l.id}><Td>{l.date}</Td><Td><span className="chip bg-slate-100 text-slate-600">{l.way === 'SHIFT_END' ? 'Shift end' : 'Weighing'}</span></Td><Td>{l.dept}</Td><Td>{l.kar}</Td><Td>{l.ono || '—'}</Td><Td right>{g3(l.weight_given)}</Td><Td right>{g3(l.weight_received)}</Td><Td right className="text-rose-600">{g3(l.loss_gross)}</Td><Td right className="font-bold">{g3(l.loss_fine)}</Td></tr>))}</Table></Card>
        {p.can_add ? <Card title="Book a loss"><ActionForm action={bookLoss} submit="Book loss"><div className="grid grid-cols-2 gap-3">
          <Field label="How" className="col-span-2"><select name="way" className="input"><option value="SHIFT_END">Way 1 — Shift-end closing</option><option value="WEIGHING">Way 2 — Weigh anytime</option></select></Field>
          <Field label="Karigar"><select name="karigar_id" className="input" required><option value="">Select…</option>{kars.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Department"><select name="dept_id" className="input"><option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Order"><select name="order_id" className="input"><option value="">—</option>{orders.map((d) => <option key={d.id} value={d.id}>{d.no}</option>)}</select></Field>
          <Field label="Jewel"><select name="jewel_type_id" className="input"><option value="">—</option>{jewels.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Weight given (g)" hint="Blank = karigar’s full balance"><input name="weight_given" type="number" step="0.001" className="input num" /></Field>
          <Field label="Weight received (g)"><input name="weight_received" type="number" step="0.001" className="input num" required /></Field>
          <Field label="Touch %"><input name="touch" type="number" step="0.01" defaultValue="91.6" className="input num" /></Field>
          <Field label="Dust recovered (g)"><input name="recovered" type="number" step="0.001" defaultValue={0} className="input num" /></Field>
          <Field label="Date"><input name="date" type="date" className="input" /></Field><Field label="Note"><input name="note" className="input" /></Field>
        </div></ActionForm></Card> : null}
      </div>
    </>
  );
}
