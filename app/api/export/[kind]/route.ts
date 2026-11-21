import { NextRequest, NextResponse } from 'next/server';
import { getSession, permOf, audit } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { buildEInvoice, buildEWayBill, buildGstr1, validateForEInvoice } from '@/lib/gst';

const csv = (rows: any[]) => {
  if (!rows.length) return 'no data\n';
  const h = Object.keys(rows[0]); const e = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [h.join(','), ...rows.map((r) => h.map((k) => e(r[k])).join(','))].join('\n');
};
const file = (body: string, name: string, type: string) => new NextResponse(body, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"` } });

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const s = await getSession(); if (!s) return new NextResponse('Unauthorized', { status: 401 });
  const { kind } = await params; const q = req.nextUrl.searchParams; const db = getDb();
  const need = kind.startsWith('einvoice') || kind === 'gstr1' || kind === 'eway' ? 'gst' : kind === 'loss' ? 'loss' : 'billing';
  if (!permOf(s, need).can_view) return new NextResponse('Forbidden', { status: 403 });
  audit(s, 'export', kind, q.toString());
  if (kind === 'einvoice') {
    const id = Number(q.get('id')); const errs = validateForEInvoice(id).filter((e) => !e.includes('already'));
    if (errs.length) return NextResponse.json({ errors: errs }, { status: 422 });
    return file(JSON.stringify([buildEInvoice(id)], null, 2), `einvoice-${id}.json`, 'application/json');
  }
  if (kind === 'einvoice-bulk') {
    const ids = (db.prepare("SELECT id FROM invoices WHERE type='GST' AND irn IS NULL AND status!='Cancelled' AND substr(date,1,7)=?").all(q.get('month')) as { id: number }[]).filter((r) => !validateForEInvoice(r.id).filter((e) => !e.includes('already')).length);
    return file(JSON.stringify(ids.map((r) => buildEInvoice(r.id)), null, 2), `einvoice-${q.get('month')}.json`, 'application/json');
  }
  if (kind === 'eway') return file(JSON.stringify({ version: '1.0.0123', billLists: [buildEWayBill(Number(q.get('id')), q.get('vehicle') || '', Number(q.get('km') || 0))] }, null, 2), `eway-${q.get('id')}.json`, 'application/json');
  if (kind === 'gstr1') return file(JSON.stringify(buildGstr1(q.get('month') || new Date().toISOString().slice(0, 7)), null, 2), `gstr1-${q.get('month')}.json`, 'application/json');
  if (kind === 'sales') return file(csv(db.prepare("SELECT i.no,i.type,i.date,p.name party,p.gstin,i.taxable,i.cgst,i.sgst,i.igst,i.total,i.paid,i.irn FROM invoices i JOIN parties p ON p.id=i.party_id WHERE i.status!='Cancelled' ORDER BY i.date").all()), 'sales-register.csv', 'text/csv');
  if (kind === 'loss') return file(csv(db.prepare('SELECT l.date,l.way,d.name department,u.name karigar,o.no order_no,l.weight_given,l.weight_received,l.touch,l.loss_gross,l.loss_fine,l.recovered FROM loss_entries l LEFT JOIN departments d ON d.id=l.dept_id LEFT JOIN users u ON u.id=l.karigar_id LEFT JOIN orders o ON o.id=l.order_id ORDER BY l.date').all()), 'loss-report.csv', 'text/csv');
  if (kind === 'ledger') return file(csv(db.prepare('SELECT g.date,g.acct_type,g.acct_id,g.dir,g.gross,g.touch,g.fine,g.ref_type,g.narration FROM gold_ledger g ORDER BY g.date,g.id').all()), 'gold-ledger.csv', 'text/csv');
  return new NextResponse('Unknown export', { status: 404 });
}
