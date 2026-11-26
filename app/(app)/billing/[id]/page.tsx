import { notFound } from 'next/navigation';
import Link from 'next/link';
import { guard, permOf } from '@/lib/auth';
import { getDb, settings } from '@/lib/db';
import { cancelInvoice } from '@/actions/bill';
import { loadInvoice } from '@/lib/gst';
import { g3, inr, rupeesInWords } from '@/lib/gold';
import { PrintButton } from '@/components/PrintButton';
import Image from 'next/image';
export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await guard('billing'); const p = permOf(s, 'billing'); const { id } = await params; const d = loadInvoice(Number(id)); if (!d) notFound(); const S = settings(); const { inv, items, party } = d;
  const intra = inv.place_of_supply === S.company_state_code; const title = inv.type === 'GST' ? 'TAX INVOICE' : inv.type === 'GOLD' ? 'GOLD BILL' : 'CASH BILL';
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2"><Link href="/billing" className="btn-ghost">← Back</Link><PrintButton />
        {p.can_delete && inv.status !== 'Cancelled' && !inv.irn && <form action={cancelInvoice}><input type="hidden" name="id" value={inv.id} /><button className="btn-danger">Cancel bill</button></form>}
        {inv.type === 'GST' && <Link href="/gst" className="btn-ghost">e-Invoice →</Link>}</div>
      <article className="card relative p-4 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        {inv.status === 'Cancelled' && <p className="absolute right-4 top-16 rotate-12 rounded-xl border-4 border-rose-500 px-4 py-1 text-2xl font-black text-rose-500 sm:right-8 sm:top-24 sm:text-3xl">CANCELLED</p>}
        <header className="flex flex-col gap-4 border-b-2 border-brand-500 pb-5 print:flex-row print:items-start print:justify-between sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-4"><Image src="/swastik-logo.png" alt="Swastik Jewellers" width={1024} height={792} className="h-auto w-16 shrink-0 sm:w-20" /><div className="min-w-0"><h1 className="text-xl font-extrabold sm:text-2xl">{S.company_name}</h1><p className="mt-1 whitespace-pre-line text-sm text-slate-500">{S.company_address}{'\n'}{S.company_phone}</p>{S.company_gstin && <p className="mt-1 text-sm font-semibold">GSTIN: {S.company_gstin}</p>}</div></div><div className="sm:text-right"><p className="text-lg font-extrabold text-brand-600 sm:text-xl">{title}</p><p className="mt-1 text-sm"><b>{inv.no}</b></p><p className="text-sm text-slate-500">Date: {inv.date}</p></div></header>
        <section className="grid grid-cols-1 gap-6 py-5 text-sm print:grid-cols-2 sm:grid-cols-2"><div className="min-w-0"><p className="label">Billed to</p><p className="font-bold">{party.name}</p><p className="text-slate-500">{party.address}</p>{party.gstin && <p>GSTIN: {party.gstin}</p>}<p className="text-slate-500">{party.mobile}</p></div>{inv.type === 'GST' && <div className="sm:text-right"><p className="label">Place of supply</p><p className="font-bold">{party.state} ({inv.place_of_supply})</p></div>}</section>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-brand-500 text-white"><tr>{(inv.type === 'GOLD' ? ['#', 'Description', 'Gross g', 'Touch', 'Fine g', 'Labour ₹'] : inv.type === 'GST' ? ['#', 'Description', 'HSN', 'Qty', 'Rate', 'GST%', 'Amount'] : ['#', 'Description', 'Qty', 'Rate', 'Amount']).map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{items.map((it, i) => (<tr key={it.id}><td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2 font-medium">{it.description}</td>
            {inv.type === 'GOLD' ? <><td className="num px-3 py-2">{g3(it.gross)}</td><td className="num px-3 py-2">{it.touch}</td><td className="num px-3 py-2 font-bold">{g3(it.fine)}</td><td className="num px-3 py-2">{inr(it.amount)}</td></> : inv.type === 'GST' ? <><td className="px-3 py-2">{it.hsn}</td><td className="num px-3 py-2">{it.qty}</td><td className="num px-3 py-2">{inr(it.rate)}</td><td className="num px-3 py-2">{it.gst_rate}%</td><td className="num px-3 py-2">{inr(it.amount)}</td></> : <><td className="num px-3 py-2">{it.qty}</td><td className="num px-3 py-2">{inr(it.rate)}</td><td className="num px-3 py-2">{inr(it.amount)}</td></>}</tr>))}</tbody></table></div>
        <div className="mt-5 w-full max-w-xs space-y-1 text-sm sm:ml-auto">
          {inv.type === 'GOLD' && <><div className="flex justify-between"><span>Gross gold</span><b className="num">{g3(inv.gold_gross)} g</b></div><div className="flex justify-between text-amber-700"><span>FINE gold to be settled</span><b className="num">{g3(inv.gold_fine)} g</b></div></>}
          {inv.other_charges > 0 && <div className="flex justify-between"><span>Other charges</span><span className="num">{inr(inv.other_charges)}</span></div>}
          {inv.type !== 'GOLD' && <div className="flex justify-between"><span>Taxable value</span><span className="num">{inr(inv.taxable)}</span></div>}
          {inv.type === 'GST' && (intra ? <><div className="flex justify-between"><span>CGST</span><span className="num">{inr(inv.cgst)}</span></div><div className="flex justify-between"><span>SGST</span><span className="num">{inr(inv.sgst)}</span></div></> : <div className="flex justify-between"><span>IGST</span><span className="num">{inr(inv.igst)}</span></div>)}
          <div className="flex justify-between border-t-2 border-ink-900 pt-1.5 text-base font-extrabold"><span>{inv.type === 'GOLD' ? 'Cash total' : 'Total'}</span><span className="num">{inr(inv.total)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Paid</span><span className="num">{inr(inv.paid)}</span></div><div className="flex justify-between font-bold"><span>Balance</span><span className="num">{inr(inv.total - inv.paid)}</span></div>
        </div>
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs"><b>Amount in words:</b> {rupeesInWords(inv.total)}{inv.type === 'GOLD' && ` · plus ${g3(inv.gold_fine)} g fine gold`}</p>
        {inv.irn && <div className="mt-4 rounded-xl border border-leaf-500/40 bg-leaf-50 p-3 text-xs"><p className="font-bold text-leaf-700">e-Invoice generated</p><p className="break-all">IRN: {inv.irn}</p><p>Ack No: {inv.ack_no} · Ack Date: {inv.ack_date}</p></div>}
        {inv.note && <p className="mt-3 text-xs text-slate-500">Note: {inv.note}</p>}
        <footer className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-4 text-xs text-slate-400 print:flex-row print:items-end print:justify-between sm:flex-row sm:items-end sm:justify-between"><span>Goods once sold will not be taken back without prior agreement. Subject to jurisdiction of {S.company_state}.</span><span className="shrink-0 sm:text-right">For {S.company_name}<br /><br />Authorised signatory</span></footer>
      </article>
    </div>
  );
}
