import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { g3 } from '@/lib/gold';
import { saveDepartment, deleteDepartment } from '@/actions/core';
import { ActionForm, Field } from '@/components/Form';
import { Card, PageHeader, Table, Td, Empty } from '@/components/ui';
import { Trash2 } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function Departments() {
  const s = await guard('departments'); const p = permOf(s, 'departments'); const db = getDb();
  const rows = db.prepare(`SELECT d.*, (SELECT COUNT(*) FROM users u WHERE u.dept_id=d.id AND u.kind='karigar' AND u.active=1) karigars,
    (SELECT COUNT(*) FROM order_stages s WHERE s.dept_id=d.id AND s.status='Active') active,
    COALESCE((SELECT SUM(CASE dir WHEN 'IN' THEN fine ELSE -fine END) FROM gold_ledger WHERE acct_type='dept' AND acct_id=d.id),0) fine FROM departments d WHERE d.active=1 ORDER BY d.id`).all() as any[];
  return (
    <>
      <PageHeader title="Departments" subtitle="Stages your gold passes through" id="departments" help={{ steps: ['Add each department (Melting, Casting, Filing…) and its head.', 'Open Jewel Master next to choose which departments each jewel visits, and in what order.', 'The “Fine gold” column is the live gold balance in that department.'] }} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card pad={false} className="lg:col-span-2">
          {rows.length ? <Table head={['Department', 'Head', 'Karigars', 'Active orders', 'Fine gold', '']} right={[2, 3, 4]}>
            {rows.map((d) => (<tr key={d.id}><Td className="font-semibold">{d.name}</Td><Td>{d.head || '—'}</Td><Td right>{d.karigars}</Td><Td right>{d.active}</Td><Td right>{g3(d.fine)} g</Td>
              <Td right>{p.can_delete ? <form action={deleteDepartment}><input type="hidden" name="id" value={d.id} /><button className="text-rose-500" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></form> : null}</Td></tr>))}
          </Table> : <Empty title="No departments yet" hint="Add your first department on the right." />}
        </Card>
        {p.can_add ? <Card title="Add department"><ActionForm action={saveDepartment} submit="Add department"><div className="space-y-3"><Field label="Name"><input name="name" className="input" placeholder="Polishing" required /></Field><Field label="Department head"><input name="head" className="input" /></Field></div></ActionForm></Card> : null}
      </div>
    </>
  );
}
