import Link from 'next/link';
import { guard, permOf } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { accounts } from '@/lib/accounts';
import { saveParty } from '@/actions/bill';
import { ActionForm, Field } from '@/components/Form';
import { Card, PageHeader, Table, Td } from '@/components/ui';
import { g3, inr } from '@/lib/gold';
import { Download } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function Ledger({ searchParams }: { searchParams: Promise<{ acct?: string }> }) {
  const s = await guard('ledger'); const p = permOf(s, 'billing'); const db = getDb(); const acc = accounts(); const { acct } = await searchParams;
  const sel = acct || 'store:0'; const [t, i] = sel.split(':');
  const rows = db.prepare('SELECT * FROM gold_ledger WHERE acct_type=? AND acct_id=? ORDER BY date,id').all(t, Number(i)) as any[];
  let rg = 0, rf = 0; const withBal = rows.map((r) => { rg += r.dir === 'IN' ? r.gross : -r.gross; rf += r.dir === 'IN' ? r.fine : -r.fine; return { ...r, rg, rf }; }).reverse();
  const rate = (db.prepare('SELECT rate_24k r FROM gold_rates ORDER BY date DESC LIMIT 1').get() as any)?.r || 0;
  let cash: any[] = []; let cb = 0;
  if (t === 'party') { cash = (db.prepare('SELECT * FROM cash_ledger WHERE party_id=? ORDER BY date,id').all(Number(i)) as any[]).map((r) => { cb += r.debit - r.credit; return { ...r, cb }; }).reverse(); }
  const title = acc.find((a) => a.v === sel)?.l || sel;
  return (
    <>
      <PageHeader title="Gold & Cash Ledger" subtitle="Statement for any party, karigar, department or the store" id="ledger" help={{ steps: ['Pick an account — party, karigar, department or the main store.', 'Gold: IN adds, OUT subtracts. For a party, a positive fine balance means we hold their gold; negative means they owe us gold.', 'Cash (parties only): debit = they owe us (bills), credit = they paid.'], tip: 'Fine balance × today’s 24K rate shows the cash value if the party decides to convert gold to cash.' }}>
        <a href="/api/export/ledger" className="btn-ghost"><Download className="h-4 w-4" />CSV</a>
      </PageHeader>
      <form className="no-print mb-5 flex items-end gap-3"><Field label="Account" className="min-w-72"><select name="acct" defaultValue={sel} className="input">{acc.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field><button className="btn-primary">Show</button></form>
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Gross balance', g3(rg) + ' g', 'bg-brand-50 text-brand-700'], ['Fine balance', g3(rf) + ' g', 'bg-amber-50 text-amber-700'], [`Value @ ₹${rate}/g`, inr(rf * rate), 'bg-leaf-50 text-leaf-700']].map(([l, v, c]) => <div key={l} className={`rounded-2xl p-4 ${c}`}><p className="text-xs font-bold uppercase opacity-70">{l}</p><p className="num mt-1 text-2xl font-extrabold">{v}</p></div>)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title={`Gold ledger — ${title}`} pad={false}><Table head={['Date', 'Narration', 'In g', 'Out g', 'Touch', 'Fine ±', 'Fine balance']} right={[2, 3, 4, 5, 6]}>
            {withBal.map((r) => (<tr key={r.id}><Td>{r.date}</Td><Td>{r.narration}<div className="text-xs text-slate-400">{r.ref_type}</div></Td><Td right>{r.dir === 'IN' ? g3(r.gross) : ''}</Td><Td right>{r.dir === 'OUT' ? g3(r.gross) : ''}</Td><Td right>{r.touch}</Td><Td right className={r.dir === 'IN' ? 'text-leaf-600' : 'text-rose-600'}>{r.dir === 'IN' ? '+' : '−'}{g3(r.fine)}</Td><Td right className="font-bold">{g3(r.rf)}</Td></tr>))}
            {!withBal.length && <tr><Td className="text-slate-400">No gold entries for this account.</Td></tr>}</Table></Card>
          {t === 'party' && <Card title="Cash ledger" pad={false}><Table head={['Date', 'Narration', 'Debit (bill)', 'Credit (paid)', 'Balance due']} right={[2, 3, 4]}>{cash.map((r) => (<tr key={r.id}><Td>{r.date}</Td><Td>{r.narration}</Td><Td right>{r.debit ? inr(r.debit) : ''}</Td><Td right className="text-leaf-600">{r.credit ? inr(r.credit) : ''}</Td><Td right className="font-bold">{inr(r.cb)}</Td></tr>))}</Table></Card>}
        </div>
        {p.can_add ? <Card title="Add party / customer"><ActionForm action={saveParty} submit="Save party"><div className="space-y-3">
          <Field label="Name"><input name="name" className="input" required /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Type"><select name="type" className="input"><option value="B2B">B2B (business)</option><option value="B2C">B2C (customer)</option><option value="SUPPLIER">Supplier</option></select></Field><Field label="Mobile"><input name="mobile" className="input" inputMode="tel" /></Field></div>
          <Field label="GSTIN" hint="Needed for B2B GST bills & e-Invoice"><input name="gstin" className="input uppercase" maxLength={15} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="State"><input name="state" defaultValue="Maharashtra" className="input" /></Field><Field label="State code"><input name="state_code" defaultValue="27" className="input" /></Field></div>
          <Field label="Address"><input name="address" className="input" /></Field><Field label="Pincode"><input name="pincode" className="input" maxLength={6} /></Field></div></ActionForm></Card> : null}
      </div>
    </>
  );
}
