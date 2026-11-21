import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { saveMelting } from '@/actions/ops';
import { MeltingForm } from '@/components/Interactive';
import { Card, PageHeader, Table, Td } from '@/components/ui';
import { g3 } from '@/lib/gold';
export const dynamic = 'force-dynamic';

export default async function Melting() {
  const s = await guard('melting'); const p = permOf(s, 'melting'); const db = getDb();
  const parties = db.prepare('SELECT id,name FROM parties WHERE active=1').all() as any[]; const kars = db.prepare("SELECT id,name FROM users WHERE kind='karigar' AND active=1").all() as any[];
  const rows = db.prepare('SELECT m.*, u.name kar FROM melting_batches m LEFT JOIN users u ON u.id=m.karigar_id ORDER BY m.id DESC LIMIT 20').all() as any[];
  return (
    <>
      <PageHeader title="Melting & Multi-Touch Calculation" subtitle="Mix lots of different touch into one bar and record the loss" id="melting" help={{ steps: ['Add each lot going into the furnace: weight and touch (e.g. 200 g @ 75 and 100 g @ 91.6).', 'Set the target touch (e.g. 91.6). The box shows total fine, average touch, and exactly how much alloy — or pure gold — to add.', 'After melting, weigh the bar and enter the assay touch. The melting loss (fine) is saved automatically.'], tip: 'Fine gold never changes by mixing — only the gross weight does. Any shortfall in fine after melting is real loss.' }} />
      <div className="grid gap-6 xl:grid-cols-5">
        {p.can_add ? <Card title="New melting" className="xl:col-span-3"><MeltingForm action={saveMelting} parties={parties} karigars={kars} /></Card> : null}
        <Card title="Melting history" pad={false} className="xl:col-span-2"><Table head={['Batch', 'In g / fine', 'Out g @ touch', 'Loss fine']} right={[3]}>
          {rows.map((m) => (<tr key={m.id}><Td className="font-semibold">{m.no}<div className="text-xs font-normal text-slate-400">{m.date} · {m.kar || '—'}</div></Td><Td>{g3(m.input_gross)}<div className="text-xs text-amber-700">{g3(m.input_fine)} fine</div></Td><Td>{g3(m.output_gross)} @ {m.output_touch}</Td><Td right className={m.loss_fine > 0.001 ? 'font-bold text-rose-600' : 'font-bold text-leaf-600'}>{g3(m.loss_fine)} g</Td></tr>))}</Table></Card>
      </div>
    </>
  );
}
