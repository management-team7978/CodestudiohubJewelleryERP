'use server';
import { revalidatePath } from 'next/cache';
import { getDb, settings } from '@/lib/db';
import { audit, guard } from '@/lib/auth';
import { fineOf, gstSplit, r2, r3 } from '@/lib/gold';
import { isGstin, pushEInvoice } from '@/lib/gst';
import { bad, dateOr, int, num, ok, postGold, Res, str } from './util';

type Line = { description: string; hsn?: string; qty?: number; gross?: number; touch?: number; rate?: number; amount?: number; gst_rate?: number };

/**
 * Three bill kinds:
 *  GOLD – jewellery billed in gold (fine) + labour in cash. Party's gold account is debited (fine), cash account gets labour.
 *  CASH – plain cash bill, no GST.
 *  GST  – tax invoice (CGST+SGST or IGST). Cash account gets the full total.
 */
export async function createInvoice(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('billing', 'add'); const db = getDb(); const S = settings();
  const type = str(f, 'type') as 'GOLD' | 'CASH' | 'GST'; if (!['GOLD', 'CASH', 'GST'].includes(type)) return bad('Choose a bill type.');
  const party = int(f, 'party_id'); if (!party) return bad('Choose the customer.');
  let lines: Line[] = []; try { lines = JSON.parse(str(f, 'lines')); } catch { /* ignore */ }
  lines = lines.filter((l) => l.description);
  if (!lines.length) return bad('Add at least one item line.');
  const p = db.prepare('SELECT * FROM parties WHERE id=?').get(party) as any;
  const pos = str(f, 'place_of_supply') || p.state_code || S.company_state_code; const intra = pos === S.company_state_code;
  if (type === 'GST' && p.gstin && !isGstin(p.gstin)) return bad('Customer GSTIN format is invalid. Fix it in Parties first.');
  const prefix = S[`invoice_prefix_${type.toLowerCase()}`] || type + '/';
  const no = prefix + String((db.prepare('SELECT COUNT(*) c FROM invoices WHERE type=?').get(type) as any).c + 1).padStart(4, '0');
  const d = dateOr(f, 'date'); const rate = num(f, 'gold_rate');
  let goldGross = 0, goldFine = 0, labour = 0, taxable = 0, cgst = 0, sgst = 0, igst = 0;
  const rows = lines.map((l) => {
    const gross = Number(l.gross) || 0, touch = Number(l.touch) || 100; const qty = Number(l.qty) || (gross || 1);
    if (type === 'GOLD') { const fine = fineOf(gross, touch); const lab = Number(l.amount) || 0; goldGross += gross; goldFine += fine; labour += lab; return { ...l, gross, touch, fine, qty: gross, rate: 0, amount: lab, gst_rate: 0 }; }
    const amount = r2(Number(l.amount) || qty * (Number(l.rate) || 0)); const gr = type === 'GST' ? (l.gst_rate ?? Number(S.gst_jewellery)) : 0;
    taxable += amount; const t = gstSplit(amount, gr, intra); cgst += t.cgst; sgst += t.sgst; igst += t.igst;
    return { ...l, gross, touch, fine: 0, qty, rate: Number(l.rate) || 0, amount, gst_rate: gr };
  });
  const other = num(f, 'other_charges'); let total: number;
  if (type === 'GOLD') { taxable = r2(labour + other); total = taxable; } else { taxable = r2(taxable + other); total = r2(taxable + cgst + sgst + igst); }
  const goldValue = type === 'GOLD' && rate ? r2(goldFine * rate) : 0;
  db.transaction(() => {
    const id = Number(db.prepare('INSERT INTO invoices(no,type,date,party_id,order_id,place_of_supply,gold_gross,gold_fine,gold_rate,labour,other_charges,taxable,cgst,sgst,igst,total,note,einv_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(no, type, d, party, int(f, 'order_id') || null, pos, r3(goldGross), r3(goldFine), rate, r2(labour), other, taxable, r2(cgst), r2(sgst), r2(igst), total, str(f, 'note'), type === 'GST' && isGstin(p.gstin) ? 'Pending' : 'NA').lastInsertRowid);
    for (const r of rows) db.prepare('INSERT INTO invoice_items(invoice_id,description,hsn,qty,gross,touch,fine,rate,amount,gst_rate) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, r.description, r.hsn || S.hsn_jewellery, r.qty, r.gross, r.touch, r.fine, r.rate, r.amount, r.gst_rate);
    if (total) db.prepare('INSERT INTO cash_ledger(date,party_id,debit,ref_type,ref_id,narration) VALUES(?,?,?,?,?,?)').run(d, party, total, 'invoice', id, `Invoice ${no}`);
    if (type === 'GOLD' && goldFine > 0) {
      postGold({ date: d, acct_type: 'party', acct_id: party, dir: 'OUT', gross: r3(goldGross), touch: goldGross ? r3((goldFine / goldGross) * 100) : 100, fine: r3(goldFine), ref_type: 'invoice', ref_id: id, narration: `Gold bill ${no}`, by: s.uid });
      if (goldValue) db.prepare('UPDATE invoices SET note=? WHERE id=?').run(`${str(f, 'note')} (fine ${r3(goldFine)} g @ ₹${rate} = ₹${goldValue})`.trim(), id);
    }
  })();
  audit(s, 'billing', 'create', `${type} ${no} ₹${total}`); revalidatePath('/billing', 'layout'); revalidatePath('/ledger'); revalidatePath('/gst');
  return ok(`${type === 'GOLD' ? 'Gold bill' : type === 'CASH' ? 'Cash bill' : 'GST invoice'} ${no} created.`);
}

export async function cancelInvoice(f: FormData) {
  const s = await guard('billing', 'delete'); const db = getDb(); const id = int(f, 'id');
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(id) as any; if (!inv || inv.status === 'Cancelled' || inv.irn) return;
  db.transaction(() => {
    db.prepare("UPDATE invoices SET status='Cancelled' WHERE id=?").run(id);
    if (inv.total) db.prepare('INSERT INTO cash_ledger(date,party_id,credit,ref_type,ref_id,narration) VALUES(?,?,?,?,?,?)').run(new Date().toISOString().slice(0, 10), inv.party_id, inv.total, 'cancel', id, `Cancelled ${inv.no}`);
    if (inv.type === 'GOLD' && inv.gold_fine) postGold({ date: new Date().toISOString().slice(0, 10), acct_type: 'party', acct_id: inv.party_id, dir: 'IN', gross: inv.gold_gross, touch: inv.gold_gross ? (inv.gold_fine / inv.gold_gross) * 100 : 100, fine: inv.gold_fine, ref_type: 'cancel', ref_id: id, narration: `Cancelled ${inv.no}`, by: s.uid });
  })(); audit(s, 'billing', 'cancel', inv.no); revalidatePath('/billing', 'layout'); revalidatePath('/ledger');
}

export async function addReceipt(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('billing', 'add'); const db = getDb(); const party = int(f, 'party_id'); const mode = str(f, 'mode') || 'CASH';
  if (!party) return bad('Choose the party.'); const d = dateOr(f, 'date'); const inv = int(f, 'invoice_id') || null;
  const no = 'RC-' + String((db.prepare('SELECT COUNT(*) c FROM receipts').get() as any).c + 1).padStart(4, '0');
  if (mode === 'GOLD') {
    const gross = num(f, 'gross'), touch = num(f, 'touch') || 100; if (gross <= 0) return bad('Enter gold weight.'); const fine = fineOf(gross, touch);
    db.transaction(() => {
      db.prepare('INSERT INTO receipts(no,date,party_id,invoice_id,mode,gross,touch,fine,note) VALUES(?,?,?,?,?,?,?,?,?)').run(no, d, party, inv, mode, gross, touch, fine, str(f, 'note'));
      postGold({ date: d, acct_type: 'party', acct_id: party, dir: 'IN', gross, touch, fine, ref_type: 'receipt', narration: `Gold receipt ${no}`, by: s.uid });
      postGold({ date: d, acct_type: 'store', acct_id: 0, dir: 'IN', gross, touch, fine, ref_type: 'receipt', narration: `Gold receipt ${no}`, by: s.uid });
    })(); audit(s, 'billing', 'receipt-gold', no); revalidatePath('/billing', 'layout'); revalidatePath('/ledger'); return ok(`Gold receipt ${no}: ${fine.toFixed(3)} g fine credited.`);
  }
  const amt = num(f, 'amount'); if (amt <= 0) return bad('Enter the amount.');
  db.transaction(() => {
    db.prepare('INSERT INTO receipts(no,date,party_id,invoice_id,mode,amount,note) VALUES(?,?,?,?,?,?,?)').run(no, d, party, inv, mode, amt, str(f, 'note'));
    db.prepare('INSERT INTO cash_ledger(date,party_id,credit,ref_type,narration) VALUES(?,?,?,?,?)').run(d, party, amt, 'receipt', `${mode} receipt ${no}`);
    if (inv) db.prepare('UPDATE invoices SET paid=paid+? WHERE id=?').run(amt, inv);
  })(); audit(s, 'billing', 'receipt', `${no} ₹${amt}`); revalidatePath('/billing', 'layout'); revalidatePath('/ledger'); return ok(`Receipt ${no} saved.`);
}

/* ---------- e-Invoice: direct upload or manual IRN entry ---------- */
export async function pushInvoice(f: FormData) {
  const s = await guard('gst', 'edit'); const id = int(f, 'id'); const db = getDb(); const r = await pushEInvoice(id);
  db.prepare('INSERT INTO einvoice_log(invoice_id,mode,ok,message,request,response) VALUES(?,?,?,?,?,?)').run(id, 'api', r.ok ? 1 : 0, r.message, JSON.stringify(r.request ?? null), JSON.stringify(r.response ?? null));
  if (r.ok) db.prepare("UPDATE invoices SET irn=?, ack_no=?, ack_date=?, signed_qr=?, einv_status='Generated' WHERE id=?").run(r.irn, r.ackNo, r.ackDt, r.qr ?? null, id);
  else db.prepare("UPDATE invoices SET einv_status='Failed' WHERE id=? AND irn IS NULL").run(id);
  audit(s, 'gst', r.ok ? 'einvoice-ok' : 'einvoice-fail', String(id)); revalidatePath('/gst', 'layout');
}
export async function manualIrn(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('gst', 'edit'); const id = int(f, 'id'); const irn = str(f, 'irn');
  if (irn.length < 16) return bad('Paste the IRN shown on the government portal.');
  getDb().prepare("UPDATE invoices SET irn=?, ack_no=?, ack_date=?, einv_status='Generated' WHERE id=?").run(irn, str(f, 'ack_no'), str(f, 'ack_date'), id);
  audit(s, 'gst', 'irn-manual', String(id)); revalidatePath('/gst', 'layout'); return ok('IRN saved on the invoice.');
}
export async function saveParty(_: Res | null, f: FormData): Promise<Res> {
  const s = await guard('billing', 'add'); const name = str(f, 'name'); if (!name) return bad('Name is required.');
  const g = str(f, 'gstin').toUpperCase(); if (g && !isGstin(g)) return bad('GSTIN format is not valid (15 characters, e.g. 27ABCDE1234F1Z5).');
  getDb().prepare('INSERT INTO parties(name,type,mobile,gstin,state,state_code,address,pincode) VALUES(?,?,?,?,?,?,?,?)').run(name, str(f, 'type') || 'B2B', str(f, 'mobile'), g || null, str(f, 'state') || 'Maharashtra', g ? g.slice(0, 2) : str(f, 'state_code') || '27', str(f, 'address'), str(f, 'pincode'));
  audit(s, 'billing', 'party-create', name); revalidatePath('/', 'layout'); return ok('Party saved.');
}
