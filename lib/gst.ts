import { getDb, settings } from './db';
import { gstSplit, r2 } from './gold';

type Inv = any; type Item = any; type Party = any;
const ddmmyyyy = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
const clean = (s: string | null | undefined, n = 100) => (s || '').toString().slice(0, n);

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const isGstin = (g?: string | null) => !!g && GSTIN_RE.test(g.trim().toUpperCase());

export function loadInvoice(id: number) {
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(id) as Inv;
  if (!inv) return null;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id').all(id) as Item[];
  const party = db.prepare('SELECT * FROM parties WHERE id=?').get(inv.party_id) as Party;
  return { inv, items, party };
}

/** NIC e-Invoice schema v1.1 payload (the standard format accepted by the IRP / every GSP). */
export function buildEInvoice(id: number) {
  const d = loadInvoice(id); if (!d) throw new Error('Invoice not found');
  const S = settings(); const { inv, items, party } = d;
  const intra = (S.company_state_code || '27') === (inv.place_of_supply || party.state_code);
  const b2b = isGstin(party.gstin);
  const lines = items.map((it, i) => {
    const ass = r2(it.amount); const t = gstSplit(ass, it.gst_rate, intra);
    return {
      SlNo: String(i + 1), PrdDesc: clean(it.description, 300), IsServc: 'N', HsnCd: it.hsn || S.hsn_jewellery || '7113',
      Qty: it.qty || 1, Unit: 'GMS', UnitPrice: r2(ass / (it.qty || 1)), TotAmt: ass, Discount: 0, AssAmt: ass, GstRt: it.gst_rate,
      IgstAmt: t.igst, CgstAmt: t.cgst, SgstAmt: t.sgst, TotItemVal: r2(ass + t.cgst + t.sgst + t.igst),
    };
  });
  const sum = (k: string) => r2(lines.reduce((s, l: any) => s + l[k], 0));
  return {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: b2b ? 'B2B' : 'B2C', RegRev: 'N', IgstOnIntra: 'N' },
    DocDtls: { Typ: 'INV', No: inv.no, Dt: ddmmyyyy(inv.date) },
    SellerDtls: { Gstin: S.company_gstin, LglNm: S.company_name, Addr1: clean(S.company_address, 100), Loc: S.company_state, Pin: Number(S.company_pincode || 0), Stcd: S.company_state_code },
    BuyerDtls: { Gstin: (party.gstin || 'URP').toUpperCase(), LglNm: party.name, Pos: inv.place_of_supply || party.state_code, Addr1: clean(party.address, 100), Loc: party.state, Pin: Number(party.pincode || 0), Stcd: party.state_code },
    ItemList: lines,
    ValDtls: { AssVal: sum('AssAmt'), CgstVal: sum('CgstAmt'), SgstVal: sum('SgstAmt'), IgstVal: sum('IgstAmt'), TotInvVal: r2(inv.total) },
  };
}

/** Pre-flight checks so the user fixes data before upload. */
export function validateForEInvoice(id: number): string[] {
  const d = loadInvoice(id); if (!d) return ['Invoice not found'];
  const S = settings(); const errs: string[] = [];
  if (d.inv.type !== 'GST') errs.push('Only GST invoices can go to the e-Invoice portal.');
  if (!isGstin(S.company_gstin)) errs.push('Your company GSTIN is missing or invalid (Settings → Company).');
  if (!isGstin(d.party.gstin)) errs.push('Buyer GSTIN is missing/invalid — e-Invoice is only for B2B (registered) buyers.');
  if (!d.items.length) errs.push('Invoice has no items.');
  if (!/^\d{6}$/.test(S.company_pincode || '')) errs.push('Company pincode must be 6 digits.');
  if (!/^\d{6}$/.test(d.party.pincode || '')) errs.push('Buyer pincode must be 6 digits.');
  if (d.inv.irn) errs.push('IRN already generated for this invoice.');
  return errs;
}

export function buildEWayBill(id: number, vehicle = '', distanceKm = 0) {
  const d = loadInvoice(id); if (!d) throw new Error('Invoice not found'); const S = settings();
  return {
    supplyType: 'O', subSupplyType: 1, docType: 'INV', docNo: d.inv.no, docDate: ddmmyyyy(d.inv.date),
    fromGstin: S.company_gstin, fromTrdName: S.company_name, fromAddr1: S.company_address, fromPincode: Number(S.company_pincode), fromStateCode: Number(S.company_state_code),
    toGstin: d.party.gstin || 'URP', toTrdName: d.party.name, toAddr1: d.party.address, toPincode: Number(d.party.pincode || 0), toStateCode: Number(d.party.state_code),
    totalValue: r2(d.inv.taxable), cgstValue: d.inv.cgst, sgstValue: d.inv.sgst, igstValue: d.inv.igst, totInvValue: d.inv.total,
    transDistance: distanceKm, vehicleNo: vehicle, transMode: 1,
    itemList: d.items.map((it, i) => ({ itemNo: i + 1, productName: it.description, hsnCode: Number(it.hsn || 7113), quantity: it.qty, qtyUnit: 'GMS', taxableAmount: r2(it.amount), cgstRate: d.inv.cgst ? it.gst_rate / 2 : 0, sgstRate: d.inv.sgst ? it.gst_rate / 2 : 0, igstRate: d.inv.igst ? it.gst_rate : 0 })),
  };
}

/** GSTR-1 JSON (b2b, b2cs, hsn, doc summary) for a month "YYYY-MM". */
export function buildGstr1(month: string) {
  const db = getDb(); const S = settings();
  const invs = db.prepare("SELECT * FROM invoices WHERE type='GST' AND status!='Cancelled' AND substr(date,1,7)=?").all(month) as Inv[];
  const [y, m] = month.split('-');
  const b2b: Record<string, any> = {}; const b2cs: Record<string, any> = {}; const hsn: Record<string, any> = {};
  for (const inv of invs) {
    const party = db.prepare('SELECT * FROM parties WHERE id=?').get(inv.party_id) as Party;
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id) as Item[];
    const intra = (S.company_state_code || '27') === inv.place_of_supply;
    for (const it of items) {
      const t = gstSplit(it.amount, it.gst_rate, intra);
      const k = it.hsn || '7113';
      const h = (hsn[k] ||= { num: Object.keys(hsn).length + 1, hsn_sc: k, uqc: 'GMS', qty: 0, txval: 0, iamt: 0, camt: 0, samt: 0, rt: it.gst_rate });
      h.qty = r2(h.qty + it.qty); h.txval = r2(h.txval + it.amount); h.iamt = r2(h.iamt + t.igst); h.camt = r2(h.camt + t.cgst); h.samt = r2(h.samt + t.sgst);
    }
    if (isGstin(party.gstin)) {
      const e = (b2b[party.gstin] ||= { ctin: party.gstin, inv: [] });
      e.inv.push({
        inum: inv.no, idt: ddmmyyyy(inv.date), val: r2(inv.total), pos: inv.place_of_supply, rchrg: 'N', inv_typ: 'R',
        itms: items.map((it, i) => { const t = gstSplit(it.amount, it.gst_rate, intra); return { num: i + 1, itm_det: { txval: r2(it.amount), rt: it.gst_rate, iamt: t.igst, camt: t.cgst, samt: t.sgst, csamt: 0 } }; }),
      });
    } else {
      const k = `${inv.place_of_supply}-${items[0]?.gst_rate ?? 3}`;
      const e = (b2cs[k] ||= { sply_ty: intra ? 'INTRA' : 'INTER', pos: inv.place_of_supply, typ: 'OE', rt: items[0]?.gst_rate ?? 3, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 });
      e.txval = r2(e.txval + inv.taxable); e.iamt = r2(e.iamt + inv.igst); e.camt = r2(e.camt + inv.cgst); e.samt = r2(e.samt + inv.sgst);
    }
  }
  return { gstin: S.company_gstin, fp: m + y, version: 'GST3.0.4', hash: 'hash', b2b: Object.values(b2b), b2cs: Object.values(b2cs), hsn: { data: Object.values(hsn) }, doc_issue: { doc_det: [{ doc_num: 1, docs: [{ num: 1, from: invs[0]?.no || '', to: invs.at(-1)?.no || '', totnum: invs.length, cancel: 0, net_issue: invs.length }] }] } };
}

/* ---------- Direct e-Invoice portal push (through client-provided GSP / ASP API) ---------- */
const pick = (o: any, ...keys: string[]) => { for (const k of keys) { const v = k.split('.').reduce((a, p) => (a == null ? a : a[p]), o); if (v != null) return v; } return undefined; };

export type PushResult = { ok: boolean; message: string; irn?: string; ackNo?: string; ackDt?: string; qr?: string; request?: any; response?: any };

export async function pushEInvoice(id: number): Promise<PushResult> {
  const S = settings();
  const errs = validateForEInvoice(id);
  if (errs.length) return { ok: false, message: errs.join(' ') };
  const payload = buildEInvoice(id);
  if (S.einv_mode !== 'api') return { ok: false, message: 'Direct upload is OFF. Switch “E-Invoice mode” to API in GST → Portal Settings, or download the JSON manually.', request: payload };
  const miss = ['einv_base_url', 'einv_client_id', 'einv_client_secret', 'einv_username', 'einv_password', 'einv_gstin'].filter((k) => !S[k]);
  if (miss.length) return { ok: false, message: 'Portal credentials incomplete: ' + miss.join(', '), request: payload };
  const base = S.einv_base_url.replace(/\/$/, '');
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000);
  try {
    const a = await fetch(base + (S.einv_auth_path || '/auth'), {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', client_id: S.einv_client_id, client_secret: S.einv_client_secret, gstin: S.einv_gstin },
      body: JSON.stringify({ username: S.einv_username, password: S.einv_password, gstin: S.einv_gstin, client_id: S.einv_client_id, client_secret: S.einv_client_secret }),
    });
    const aj: any = await a.json().catch(() => ({}));
    const token = pick(aj, 'token', 'access_token', 'data.token', 'Data.AuthToken', 'data.access_token');
    if (!a.ok || !token) return { ok: false, message: `Portal login failed (${a.status}): ${pick(aj, 'message', 'error', 'ErrorMessage') || 'no token returned'}`, request: payload, response: aj };
    const r = await fetch(base + (S.einv_irn_path || '/einvoice/generate'), {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, client_id: S.einv_client_id, client_secret: S.einv_client_secret, gstin: S.einv_gstin, user_name: S.einv_username },
      body: JSON.stringify(payload),
    });
    const rj: any = await r.json().catch(() => ({}));
    const irn = pick(rj, 'Irn', 'irn', 'data.Irn', 'result.Irn', 'Data.Irn');
    if (!r.ok || !irn) return { ok: false, message: `Portal rejected the invoice (${r.status}): ${JSON.stringify(pick(rj, 'message', 'error', 'ErrorDetails', 'ErrorMessage') ?? rj).slice(0, 400)}`, request: payload, response: rj };
    return { ok: true, message: 'IRN generated', irn, ackNo: String(pick(rj, 'AckNo', 'ackNo', 'data.AckNo', 'result.AckNo') ?? ''), ackDt: String(pick(rj, 'AckDt', 'ackDt', 'data.AckDt', 'result.AckDt') ?? ''), qr: pick(rj, 'SignedQRCode', 'signedQRCode', 'data.SignedQRCode', 'result.SignedQRCode'), request: payload, response: rj };
  } catch (e: any) {
    return { ok: false, message: 'Could not reach the portal: ' + (e?.name === 'AbortError' ? 'timed out' : e?.message), request: payload };
  } finally { clearTimeout(to); }
}
