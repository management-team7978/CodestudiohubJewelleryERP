import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { goldReceive, goldReturn, goldPurchase } from '@/actions/ops';
import { TouchForm } from '@/components/Interactive';
import { Card, PageHeader, Table, Td, Stat } from '@/components/ui';
import { g3 } from '@/lib/gold';
import { Coins } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function Gold() {
  const s = await guard('gold'); const p = permOf(s, 'gold'); const db = getDb();
  const parties = db.prepare("SELECT id,name FROM parties WHERE active=1").all() as any[];
  const bal = db.prepare(`SELECT p.id,p.name,p.type, COALESCE(SUM(CASE g.dir WHEN 'IN' THEN g.gross ELSE -g.gross END),0) gross, COALESCE(SUM(CASE g.dir WHEN 'IN' THEN g.fine ELSE -g.fine END),0) fine FROM parties p LEFT JOIN gold_ledger g ON g.acct_type='party' AND g.acct_id=p.id WHERE p.active=1 GROUP BY p.id HAVING gross<>0 OR fine<>0 ORDER BY p.name`).all() as any[];
  const recent = db.prepare("SELECT g.*, p.name pn FROM gold_ledger g LEFT JOIN parties p ON g.acct_type='party' AND p.id=g.acct_id WHERE g.acct_type='party' ORDER BY g.id DESC LIMIT 14").all() as any[];
  const store = db.prepare("SELECT COALESCE(SUM(CASE dir WHEN 'IN' THEN fine ELSE -fine END),0) f, COALESCE(SUM(CASE dir WHEN 'IN' THEN gross ELSE -gross END),0) g FROM gold_ledger WHERE acct_type='store'").get() as any;
  return (
    <>
      <PageHeader title="Gold Desk — Touch → Fine" subtitle="Record gold received and given back, always in fine gold" id="gold" help={{ steps: ['Someone brings gold? Choose “Gold received”, enter weight and TOUCH (e.g. 75). We calculate FINE = weight × touch ÷ 100 and credit it to that party’s gold ledger.', 'Giving gold back? Choose “Give back fine”, type the FINE you owe and the touch you are giving at — we work out the gross weight.', 'Several lots with different touches? Mix them in Melting to reach one target touch.'], tip: 'Example: 200 g at 75 touch = 150.000 g fine. You can later return 150 g fine as 163.755 g at 91.6 touch.' }} />
      <div className="grid gap-4 sm:grid-cols-2"><Stat label="Store gold (gross)" value={g3(store.g) + ' g'} icon={<Coins />} tone="gold" /><Stat label="Store gold (fine)" value={g3(store.f) + ' g'} icon={<Coins />} tone="leaf" /></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Party fine-gold balances" pad={false}><Table head={['Party', 'Type', 'Gross held', 'Fine balance', 'Meaning']} right={[2, 3]}>
            {bal.map((b) => (<tr key={b.id}><Td className="font-semibold">{b.name}</Td><Td>{b.type}</Td><Td right>{g3(b.gross)} g</Td><Td right className={`font-bold ${b.fine >= 0 ? 'text-leaf-600' : 'text-rose-600'}`}>{g3(b.fine)} g</Td><Td className="text-xs text-slate-500">{b.fine >= 0 ? 'We hold their gold — we owe fine' : 'They owe us fine gold'}</Td></tr>))}</Table></Card>
          <Card title="Recent party gold entries" pad={false}><Table head={['Date', 'Party', 'Narration', 'Gross', 'Touch', 'Fine']} right={[3, 4, 5]}>
            {recent.map((r) => (<tr key={r.id}><Td>{r.date}</Td><Td>{r.pn}</Td><Td>{r.narration}</Td><Td right>{g3(r.gross)}</Td><Td right>{r.touch}</Td><Td right className={r.dir === 'IN' ? 'font-bold text-leaf-600' : 'font-bold text-rose-600'}>{r.dir === 'IN' ? '+' : '−'}{g3(r.fine)}</Td></tr>))}</Table></Card>
        </div>
        {p.can_add ? <div className="space-y-6">
          <Card title="⬇ Gold received"><TouchForm action={goldReceive} parties={parties} mode="receive" /></Card>
          <Card title="⬆ Give back fine"><TouchForm action={goldReturn} parties={parties} mode="return" /></Card>
          <Card title="🛒 Bullion purchase"><TouchForm action={goldPurchase} parties={parties} mode="purchase" /></Card>
        </div> : null}
      </div>
    </>
  );
}
