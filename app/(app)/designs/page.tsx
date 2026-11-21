import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { saveDesign, toggleDesign, setDesignAccess, toggleBlockParty } from '@/actions/core';
import { ActionForm, Field } from '@/components/Form';
import { DesignViewer } from '@/components/DesignViewer';
import { Badge, Card, PageHeader, Table, Td } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function Designs() {
  const s = await guard('designs'); const p = permOf(s, 'designs'); const db = getDb();
  const rows = db.prepare('SELECT * FROM designs ORDER BY id DESC').all() as any[]; const parties = db.prepare("SELECT id,name FROM parties WHERE type='B2B' AND active=1").all() as any[];
  const acc = db.prepare('SELECT * FROM design_access').all() as any[];
  const mob = (db.prepare('SELECT mobile FROM users WHERE id=?').get(s.uid) as any)?.mobile || '';
  const who = `${s.name} · ${mob}`;
  const views = db.prepare('SELECT v.*, COALESCE(u.name,p.name) un, d.code, (SELECT 1 FROM blocked_parties b WHERE b.party_id=v.party_id) blocked FROM design_views v LEFT JOIN users u ON u.id=v.user_id LEFT JOIN parties p ON p.id=v.party_id LEFT JOIN designs d ON d.id=v.design_id ORDER BY v.id DESC LIMIT 25').all() as any[];
  return (
    <>
      <PageHeader title="Design Management & Privacy" subtitle="Share designs safely with each business" id="designs" help={{ steps: ['Add a design with code, category, weight and (optional) image link.', 'Use “Access” to pick which businesses may see each design; “Hide” removes it from everyone.', 'Every view shows the viewer’s name & mobile as a watermark. Screenshot shortcuts, right-click and switching windows are blocked/blurred and logged below.'], tip: 'A web page cannot fully stop a photo taken with another phone — that is why the watermark traces the viewer. Native screenshot blocking and front-camera proctoring need the mobile app.' }} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((d) => { const ids = acc.filter((a) => a.design_id === d.id).map((a) => a.party_id); return (
            <Card key={d.id} className={d.visible ? '' : 'opacity-60'}>
              <div className="mb-3 grid aspect-[4/3] place-items-center rounded-xl bg-gradient-to-br from-amber-100 to-brand-100 text-4xl">💍</div>
              <p className="font-bold">{d.title} <span className="text-slate-400">· {d.code}</span></p><p className="mb-3 text-sm text-slate-500">{d.category} · {d.weight} g {!d.visible && <Badge>Cancelled</Badge>}</p>
              <DesignViewer id={d.id} code={d.code} title={d.title} category={d.category} weight={d.weight} image={d.image} who={who} />
              {p.can_edit && <div className="mt-2 flex gap-2"><form action={toggleDesign} className="flex-1"><input type="hidden" name="id" value={d.id} /><button className="btn-ghost w-full">{d.visible ? 'Hide' : 'Show'}</button></form>
                <details className="relative flex-1"><summary className="btn-ghost w-full cursor-pointer list-none">Access ({ids.length})</summary><form action={setDesignAccess} className="absolute right-0 z-10 mt-1 w-56 rounded-xl border bg-white p-3 shadow-lg"><input type="hidden" name="design_id" value={d.id} />{parties.map((x) => <label key={x.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" name="party" value={x.id} defaultChecked={ids.includes(x.id)} />{x.name}</label>)}<button className="btn-primary mt-2 w-full !py-1.5">Save</button></form></details></div>}
            </Card>); })}</div>
          <Card title="Design view & protection log" pad={false}><Table head={['When', 'User', 'Design', 'Event', 'Device', '']}>{views.map((v) => <tr key={v.id}><Td>{v.at}</Td><Td>{v.un}</Td><Td>{v.code}</Td><Td><span className={`chip ${v.event === 'view' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600'}`}>{v.event}</span>{v.snapshot && <details className="mt-1"><summary className="cursor-pointer text-xs text-brand-600">Snapshot</summary><img src={v.snapshot} alt="proof" className="mt-1 h-24 rounded" /></details>}</Td><Td className="text-xs text-slate-400">{v.device}</Td><Td>{v.party_id && p.can_edit && v.event !== 'view' ? <form action={toggleBlockParty}><input type="hidden" name="party_id" value={v.party_id} /><button className="btn-danger !px-2.5 !py-1 text-xs">{v.blocked ? 'Unblock' : 'Block user'}</button></form> : null}</Td></tr>)}</Table></Card>
        </div>
        {p.can_add && <Card title="Add design"><ActionForm action={saveDesign} submit="Add design"><div className="space-y-3"><Field label="Code"><input name="code" className="input" required /></Field><Field label="Title"><input name="title" className="input" /></Field><div className="grid grid-cols-2 gap-3"><Field label="Category"><input name="category" className="input" /></Field><Field label="Weight g"><input name="weight" type="number" step="0.01" className="input" /></Field></div><Field label="Image URL (optional)"><input name="image" className="input" /></Field></div></ActionForm></Card>}
      </div>
    </>
  );
}
