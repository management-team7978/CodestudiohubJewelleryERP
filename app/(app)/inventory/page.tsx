import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { saveItem, stockEntry } from '@/actions/ops';
import { ActionForm, Field } from '@/components/Form';
import { Card, PageHeader, Table, Td, Badge } from '@/components/ui';
export const dynamic = 'force-dynamic';

export default async function Inventory() {
  const s = await guard('inventory'); const p = permOf(s, 'inventory'); const db = getDb();
  const items = db.prepare(`SELECT i.*, ROUND(COALESCE(SUM(CASE t.kind WHEN 'IN' THEN t.qty WHEN 'OUT' THEN -t.qty WHEN 'RETURN' THEN t.qty ELSE t.qty END),0),3) stock FROM items i LEFT JOIN stock_txn t ON t.item_id=i.id GROUP BY i.id ORDER BY i.category,i.name`).all() as any[];
  const txn = db.prepare('SELECT t.*, i.name item, i.unit, d.name dept FROM stock_txn t JOIN items i ON i.id=t.item_id LEFT JOIN departments d ON d.id=t.dept_id ORDER BY t.id DESC LIMIT 15').all() as any[];
  const depts = db.prepare('SELECT id,name FROM departments WHERE active=1').all() as any[];
  return (
    <>
      <PageHeader title="Inventory" subtitle="Gold, stones, alloy and any other item" id="inventory" help={{ steps: ['Add each item once (name + unit: gram / carat / piece) and a minimum stock level.', 'Record every purchase (IN), issue to a department (OUT), return, or correction (ADJUST).', 'Items below the minimum show a red “Low” tag and appear in dashboard alerts.'], tip: 'Gold received from parties and bullion purchases are tracked in Gold Desk (fine gold), not here.' }} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card pad={false}><Table head={['Item', 'Category', 'Unit', 'In stock', 'Minimum', '']} right={[3, 4]}>{items.map((i) => (<tr key={i.id}><Td className="font-semibold">{i.name}</Td><Td>{i.category}</Td><Td>{i.unit}</Td><Td right className="font-bold">{i.stock}</Td><Td right>{i.min_stock}</Td><Td>{i.stock < i.min_stock ? <span className="chip bg-rose-50 text-rose-600">Low</span> : <span className="chip bg-leaf-50 text-leaf-700">OK</span>}</Td></tr>))}</Table></Card>
          <Card title="Recent stock movements" pad={false}><Table head={['Date', 'Item', 'Type', 'Qty', 'Department', 'Note']} right={[3]}>{txn.map((t) => (<tr key={t.id}><Td>{t.date}</Td><Td>{t.item}</Td><Td><Badge>{t.kind === 'IN' ? 'Received' : t.kind === 'OUT' ? 'Issued' : 'Pending'}</Badge></Td><Td right>{t.qty} {t.unit}</Td><Td>{t.dept || '—'}</Td><Td>{t.note}</Td></tr>))}</Table></Card>
        </div>
        {p.can_add ? <div className="space-y-6">
          <Card title="Stock entry"><ActionForm action={stockEntry} submit="Save entry"><div className="space-y-3">
            <Field label="Item"><select name="item_id" className="input" required><option value="">Select…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Type"><select name="kind" className="input"><option value="IN">Purchase / inward</option><option value="OUT">Issue</option><option value="RETURN">Return</option><option value="ADJUST">Adjustment (±)</option></select></Field><Field label="Quantity"><input name="qty" type="number" step="0.001" className="input num" required /></Field></div>
            <Field label="To department (for issue)"><select name="dept_id" className="input"><option value="">—</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            <Field label="Date"><input name="date" type="date" className="input" /></Field><Field label="Note"><input name="note" className="input" /></Field></div></ActionForm></Card>
          <Card title="Add new item"><ActionForm action={saveItem} submit="Add item"><div className="grid grid-cols-2 gap-3"><Field label="Name" className="col-span-2"><input name="name" className="input" required /></Field><Field label="Category"><input name="category" className="input" placeholder="Stone" /></Field><Field label="Unit"><select name="unit" className="input"><option>gram</option><option>carat</option><option>piece</option></select></Field><Field label="Min stock"><input name="min_stock" type="number" className="input" /></Field><Field label="HSN"><input name="hsn" defaultValue="7113" className="input" /></Field></div></ActionForm></Card>
        </div> : null}
      </div>
    </>
  );
}
