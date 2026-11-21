import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { saveJewel } from '@/actions/core';
import { FlowPicker } from '@/components/Interactive';
import { Card, PageHeader } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function Jewels() {
  const s = await guard('jewels'); const p = permOf(s, 'jewels'); const db = getDb();
  const jewels = db.prepare('SELECT * FROM jewel_types ORDER BY name').all() as any[]; const depts = db.prepare('SELECT id,name FROM departments WHERE active=1').all() as any[];
  const nm = (id: number) => depts.find((d) => d.id === id)?.name || '?';
  return (
    <>
      <PageHeader title="Jewel Master & Department Flow" subtitle="Choose the route each jewel takes through your factory" id="jewels" help={{ steps: ['Each card is a jewel type with its department route, e.g. Ring → Casting → Filing → Setting → Polishing → QC.', 'Add a new jewel on the left: tap departments in the order the jewel should visit them.', 'New orders for this jewel will automatically follow this route (you can change it for a single order).'] }} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {jewels.map((j) => { const flow: number[] = JSON.parse(j.flow); return (
            <Card key={j.id} title={j.name}>
              <div className="flex flex-wrap items-center gap-1.5">{flow.map((d, i) => (<span key={i} className="flex items-center gap-1.5"><span className="chip bg-brand-50 text-brand-700">{nm(d)}</span>{i < flow.length - 1 && <span className="text-slate-300">→</span>}</span>))}</div>
              {p.can_edit ? <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-brand-600">Edit flow</summary><div className="mt-3"><FlowPicker depts={depts} action={saveJewel} initial={flow} name={j.name} id={j.id} /></div></details> : null}
            </Card>); })}
        </div>
        {p.can_add ? <Card title="Add new jewel"><FlowPicker depts={depts} action={saveJewel} initial={[]} /></Card> : null}
      </div>
    </>
  );
}
