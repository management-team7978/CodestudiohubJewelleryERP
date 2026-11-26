import Link from 'next/link';
import { guard, permOf } from '@/lib/auth';
import { getDb, settings } from '@/lib/db';
import { saveSettings } from '@/actions/core';
import { pushInvoice, manualIrn } from '@/actions/bill';
import { validateForEInvoice } from '@/lib/gst';
import { ActionForm, Field } from '@/components/Form';
import { Badge, Card, PageHeader, Table, Td } from '@/components/ui';
import { inr } from '@/lib/gold';
import { Download, Send, PlugZap, FileJson, KeyRound } from 'lucide-react';
export const dynamic = 'force-dynamic';

const KEYS = ['einv_mode', 'einv_provider', 'einv_env', 'einv_base_url', 'einv_auth_path', 'einv_irn_path', 'einv_client_id', 'einv_client_secret', 'einv_username', 'einv_password', 'einv_gstin'];
export default async function GST({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await guard('gst'); const p = permOf(s, 'gst'); const db = getDb(); const S = settings(); const sp = await searchParams;
  const month = sp.month || new Date().toISOString().slice(0, 7);
  const invs = db.prepare("SELECT i.*, p.name party, p.gstin FROM invoices i JOIN parties p ON p.id=i.party_id WHERE i.type='GST' ORDER BY i.id DESC LIMIT 60").all() as any[];
  const logs = db.prepare('SELECT l.*, i.no FROM einvoice_log l LEFT JOIN invoices i ON i.id=l.invoice_id ORDER BY l.id DESC LIMIT 8').all() as any[];
  const api = S.einv_mode === 'api'; const sum = db.prepare("SELECT COALESCE(SUM(taxable),0) t, COALESCE(SUM(cgst+sgst+igst),0) x, COUNT(*) c FROM invoices WHERE type='GST' AND status!='Cancelled' AND substr(date,1,7)=?").get(month) as any;
  return (
    <>
      <PageHeader title="GST & e-Invoice" subtitle="Upload invoices straight to the government e-Invoice portal — or download the JSON yourself" id="gst" help={{ steps: ['Choose your mode in Portal Settings: “Manual JSON” (download and upload on the portal yourself) or “Direct API” (we push each invoice to the portal through your GSP).', 'For Direct API you (the client) must give us the details listed on the right: provider URL, client ID/secret, portal username & password and GSTIN. Start in Sandbox.', 'In the invoice table press “Send to portal” (API) or “JSON” (manual). The IRN and acknowledgement are saved on the invoice. Paste an IRN manually if you uploaded outside the software.'], tip: 'Only GST invoices to buyers with a valid GSTIN can be e-Invoiced. Final GST filing is your CA’s responsibility.' }} />
      <div className={`mb-6 flex flex-wrap items-center gap-3 rounded-2xl p-4 ${api ? 'bg-leaf-50 text-leaf-700' : 'bg-amber-50 text-amber-800'}`}><PlugZap className="h-5 w-5" /><b>{api ? `Direct API mode — ${S.einv_env === 'live' ? 'LIVE' : 'Sandbox'}` : 'Manual JSON mode'}</b><span className="text-sm">{api ? 'Invoices are sent to the portal through your provider.' : 'Download JSON and upload it on the e-Invoice portal. Switch to Direct API below once your provider details are ready.'}</span></div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="GST invoices" pad={false}><Table head={['Invoice', 'Buyer', 'Total', 'e-Invoice', 'Actions']} right={[2]}>
            {invs.map((i) => { const errs = validateForEInvoice(i.id).filter((e) => !e.includes('already')); return (
              <tr key={i.id} className="align-top"><Td className="font-bold"><Link href={`/billing/${i.id}`} className="text-brand-600">{i.no}</Link><div className="text-xs font-normal text-slate-400">{i.date}</div></Td><Td>{i.party}<div className="text-xs text-slate-400">{i.gstin || 'No GSTIN (B2C)'}</div></Td><Td right>{inr(i.total)}</Td>
                <Td><Badge>{i.einv_status}</Badge>{i.irn && <div className="mt-1 max-w-[180px] break-all text-[10px] text-slate-500">IRN {i.irn.slice(0, 24)}…</div>}{!i.irn && errs.length > 0 && i.einv_status !== 'NA' && <div className="mt-1 max-w-[220px] text-[11px] text-rose-600">{errs[0]}</div>}</Td>
                <Td><div className="flex flex-wrap gap-1.5">
                  {i.status !== 'Cancelled' && !i.irn && !errs.length && <a href={`/api/export/einvoice?id=${i.id}`} className="btn-ghost !px-2.5 !py-1.5 text-xs"><FileJson className="h-3.5 w-3.5" />JSON</a>}
                  {p.can_edit && api && !i.irn && !errs.length && i.status !== 'Cancelled' && <form action={pushInvoice}><input type="hidden" name="id" value={i.id} /><button className="btn-primary !px-2.5 !py-1.5 text-xs"><Send className="h-3.5 w-3.5" />Send to portal</button></form>}
                  {i.status !== 'Cancelled' && i.gstin && <a href={`/api/export/eway?id=${i.id}`} className="btn-ghost !px-2.5 !py-1.5 text-xs">e-Way JSON</a>}
                </div>
                {p.can_edit && !i.irn && i.gstin && i.status !== 'Cancelled' && <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-slate-500"><KeyRound className="mr-1 inline h-3 w-3" />Paste IRN</summary><ActionForm action={manualIrn} submit="Save IRN" className="mt-2"><input type="hidden" name="id" value={i.id} /><div className="space-y-2"><input name="irn" className="input text-xs" placeholder="IRN (64 chars)" /><div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2"><input name="ack_no" className="input text-xs" placeholder="Ack no" /><input name="ack_date" className="input text-xs" placeholder="Ack date" /></div></div></ActionForm></details>}</Td></tr>); })}
            {!invs.length && <tr><Td className="text-slate-400">No GST invoices yet — create one in Billing.</Td></tr>}</Table></Card>
          <Card title="Portal / API settings" action={<Badge>{api ? 'Generated' : 'Pending'}</Badge>}>
            <ActionForm action={saveSettings} submit="Save portal settings" resetOnOk={false}>
              <input type="hidden" name="_keys" value={KEYS.join(',')} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="E-Invoice mode"><select name="einv_mode" defaultValue={S.einv_mode} className="input"><option value="manual">Manual JSON (download &amp; upload)</option><option value="api">Direct API (auto-insert)</option></select></Field>
                <Field label="Environment"><select name="einv_env" defaultValue={S.einv_env} className="input"><option value="sandbox">Sandbox / test</option><option value="live">Live / production</option></select></Field>
                <Field label="Provider (GSP/ASP) name"><input name="einv_provider" defaultValue={S.einv_provider} className="input" placeholder="e.g. ClearTax, Masters India, IRIS" /></Field>
                <Field label="API base URL" className="sm:col-span-2"><input name="einv_base_url" defaultValue={S.einv_base_url} className="input" placeholder="https://api.provider.com/v1" /></Field>
                <Field label="Your GSTIN on portal"><input name="einv_gstin" defaultValue={S.einv_gstin} className="input uppercase" maxLength={15} /></Field>
                <Field label="Auth path"><input name="einv_auth_path" defaultValue={S.einv_auth_path} className="input" /></Field><Field label="Generate-IRN path"><input name="einv_irn_path" defaultValue={S.einv_irn_path} className="input" /></Field><span />
                <Field label="Client ID"><input name="einv_client_id" defaultValue={S.einv_client_id} className="input" autoComplete="off" /></Field>
                <Field label="Client secret"><input name="einv_client_secret" type="password" defaultValue={S.einv_client_secret} className="input" autoComplete="new-password" /></Field><span />
                <Field label="Portal username"><input name="einv_username" defaultValue={S.einv_username} className="input" autoComplete="off" /></Field>
                <Field label="Portal password"><input name="einv_password" type="password" defaultValue={S.einv_password} className="input" autoComplete="new-password" /></Field>
              </div>
            </ActionForm>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Monthly GST files">
            <form className="mb-4 flex flex-wrap items-end gap-2"><Field label="Month" className="min-w-0 w-full flex-1"><input type="month" name="month" defaultValue={month} className="input" /></Field><button className="btn-ghost w-full sm:w-auto">Go</button></form>
            <p className="mb-3 text-sm text-slate-500">{sum.c} invoices · taxable {inr(sum.t)} · GST {inr(sum.x)}</p>
            <div className="space-y-2"><a className="btn-primary w-full" href={`/api/export/gstr1?month=${month}`}><Download className="h-4 w-4" />GSTR-1 JSON</a><a className="btn-ghost w-full" href={`/api/export/einvoice-bulk?month=${month}`}><Download className="h-4 w-4" />All e-Invoice JSON (pending)</a><a className="btn-ghost w-full" href="/api/export/sales"><Download className="h-4 w-4" />Sales register CSV</a></div>
          </Card>
          <Card title="📋 Details the client must provide for Direct API"><ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li><b>GSP / ASP provider</b> account (e-Invoice API subscription) and its <b>API base URL</b></li><li><b>Client ID &amp; Client Secret</b> issued by the provider</li><li><b>E-Invoice portal username &amp; password</b> (API user created on einvoice1.gst.gov.in)</li><li>Registered <b>GSTIN</b>, legal name, address &amp; pincode</li><li>Sandbox credentials first, then live</li><li>Provider’s API document (auth &amp; generate-IRN paths) — we map them here</li></ul>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Provider charges are separate. We send the standard NIC e-Invoice 1.1 payload; response keys (Irn, AckNo, AckDt, SignedQRCode) are read automatically.</p></Card>
          <Card title="Recent portal attempts" pad={false}>{logs.length ? <ul className="divide-y divide-slate-100">{logs.map((l) => <li key={l.id} className="px-5 py-3 text-sm"><div className="flex items-center justify-between"><b>{l.no}</b><span className={l.ok ? 'text-leaf-600' : 'text-rose-600'}>{l.ok ? 'Success' : 'Failed'}</span></div><p className="text-xs text-slate-500">{l.at} — {l.message}</p></li>)}</ul> : <p className="p-5 text-sm text-slate-400">No attempts yet.</p>}</Card>
        </div>
      </div>
    </>
  );
}
