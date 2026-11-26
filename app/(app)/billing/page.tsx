import Link from 'next/link';
import { guard, permOf } from '@/lib/auth';
import { getDb, settings } from '@/lib/db';
import { createInvoice, addReceipt } from '@/actions/bill';
import { InvoiceForm } from '@/components/Interactive';
import { ActionForm, Field } from '@/components/Form';
import { Badge, Card, PageHeader, Table, Td, Empty } from '@/components/ui';
import { g3, inr } from '@/lib/gold';
import { Download } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function Billing({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const s = await guard('billing'); const p = permOf(s, 'billing'); const db = getDb(); const S = settings(); const { type } = await searchParams;
  const rows = db.prepare(`SELECT i.*, p.name party FROM invoices i JOIN parties p ON p.id=i.party_id ${type ? 'WHERE i.type=?' : ''} ORDER BY i.id DESC LIMIT 100`).all(...(type ? [type] : [])) as any[];
  const parties = db.prepare("SELECT id,name,state_code,gstin FROM parties WHERE active=1 AND type!='SUPPLIER'").all() as any[]; const orders = db.prepare('SELECT id,no FROM orders ORDER BY id DESC').all() as any[];
  const rate = (db.prepare('SELECT rate_24k r FROM gold_rates ORDER BY date DESC LIMIT 1').get() as any)?.r || 0;
  const recs = db.prepare('SELECT r.*, p.name party FROM receipts r JOIN parties p ON p.id=r.party_id ORDER BY r.id DESC LIMIT 8').all() as any[];
  const out = db.prepare("SELECT i.id,i.no,i.total-i.paid due FROM invoices i WHERE i.status!='Cancelled' AND i.total-i.paid>0.5").all() as any[];
  return (
    <>
      <PageHeader title="Billing & Receipts" subtitle="Gold bills, cash bills and GST invoices" id="billing" help={{ steps: ['Choose the bill kind: GST Invoice (with tax), Gold Bill (settle in fine gold + labour in cash) or Cash Bill (no GST).', 'Pick the customer, add item lines — totals and GST split (CGST+SGST or IGST) are calculated live.', 'Open the bill to print or save as PDF. Record payments under “Receipts” — cash, UPI, bank or gold.'], tip: 'GST invoices to registered (GSTIN) customers are ready for e-Invoice in GST & e-Invoice.' }}>
        {['', 'GST', 'GOLD', 'CASH'].map((t) => <Link key={t} href={t ? `/billing?type=${t}` : '/billing'} className={`chip !px-3 !py-1.5 ${(type || '') === t ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{t || 'All'}</Link>)}
        <a href="/api/export/sales" className="btn-ghost"><Download className="h-4 w-4" />Sales CSV</a>
      </PageHeader>
      {p.can_add && <Card title="➕ Create a bill" className="mb-6"><InvoiceForm action={createInvoice} parties={parties} orders={orders} defaults={{ rate, gst: S.gst_jewellery || '3', company_state: S.company_state_code || '27' }} /></Card>}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card pad={false} className="xl:col-span-2">{rows.length ? <Table head={['Bill', 'Type', 'Date', 'Customer', 'Total / Fine', 'Paid', 'Status']} right={[4, 5]}>
          {rows.map((i) => (<tr key={i.id} className="hover:bg-slate-50/60"><Td className="font-bold"><Link className="text-brand-600" href={`/billing/${i.id}`}>{i.no}</Link></Td><Td><Badge>{i.type}</Badge></Td><Td>{i.date}</Td><Td>{i.party}</Td>
            <Td right>{inr(i.total)}{i.type === 'GOLD' && <div className="text-xs font-bold text-amber-700">+ {g3(i.gold_fine)} g fine</div>}</Td><Td right>{inr(i.paid)}</Td><Td><Badge>{i.status}</Badge></Td></tr>))}</Table> : <Empty title="No bills yet" hint="Create your first bill above." />}</Card>
        <div className="space-y-6">
          {p.can_add && <Card title="Record receipt"><ActionForm action={addReceipt} submit="Save receipt" tone="green"><div className="space-y-3">
            <Field label="Party"><select name="party_id" className="input" required>{parties.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            <Field label="Against bill (optional)"><select name="invoice_id" className="input"><option value="">On account</option>{out.map((o) => <option key={o.id} value={o.id}>{o.no} — due {inr(o.due)}</option>)}</select></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Mode"><select name="mode" className="input"><option>CASH</option><option>UPI</option><option>BANK</option><option value="GOLD">GOLD (fine)</option></select></Field><Field label="Amount ₹"><input name="amount" type="number" step="0.01" className="input num" /></Field></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Gold gross g" hint="Only for GOLD mode"><input name="gross" type="number" step="0.001" className="input num" /></Field><Field label="Touch %"><input name="touch" type="number" step="0.01" className="input num" /></Field></div>
            <Field label="Date"><input name="date" type="date" className="input" /></Field></div></ActionForm></Card>}
          <Card title="Recent receipts" pad={false}><Table head={['No', 'Party', 'Received']} right={[2]}>{recs.map((r) => <tr key={r.id}><Td className="font-semibold">{r.no}<div className="text-xs font-normal text-slate-400">{r.date} · {r.mode}</div></Td><Td>{r.party}</Td><Td right>{r.mode === 'GOLD' ? g3(r.fine) + ' g fine' : inr(r.amount)}</Td></tr>)}</Table></Card>
        </div>
      </div>
    </>
  );
}
