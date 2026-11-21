import { guard } from '@/lib/auth';
import { getDb, settings, todayStr } from '@/lib/db';
import { saveSettings, saveGoldRate } from '@/actions/core';
import { ActionForm, Field } from '@/components/Form';
import { Card, PageHeader } from '@/components/ui';
export const dynamic = 'force-dynamic';

const F = ({ S, k, label, type = 'text', hint }: { S: Record<string, string>; k: string; label: string; type?: string; hint?: string }) => <Field label={label} hint={hint}><input name={k} type={type} defaultValue={S[k] || ''} className="input" /></Field>;
export default async function Settings() {
  await guard('settings'); const S = settings(); const rates = getDb().prepare('SELECT * FROM gold_rates ORDER BY date DESC LIMIT 6').all() as any[];
  const group = (keys: string[]) => <input type="hidden" name="_keys" value={keys.join(',')} />;
  return (
    <>
      <PageHeader title="Settings" subtitle="Company, GST, security and integrations" id="settings" help={{ steps: ['Fill Company details first — they print on every bill and go into e-Invoice JSON.', 'Enter today’s 24K gold rate daily (shown at the top of every screen).', 'GST rates are defaults for new invoice lines; you can still change them per line.'], tip: 'Direct e-Invoice API credentials live in GST & e-Invoice → Portal settings.' }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="🏪 Company details"><ActionForm action={saveSettings} resetOnOk={false}>{group(['company_name', 'company_gstin', 'company_address', 'company_state', 'company_state_code', 'company_pincode', 'company_phone', 'company_email'])}<div className="grid gap-3 sm:grid-cols-2">
          <F S={S} k="company_name" label="Business name" /><F S={S} k="company_gstin" label="GSTIN" /><F S={S} k="company_address" label="Address" /><F S={S} k="company_pincode" label="Pincode" /><F S={S} k="company_state" label="State" /><F S={S} k="company_state_code" label="State code" hint="27 = Maharashtra" /><F S={S} k="company_phone" label="Phone" /><F S={S} k="company_email" label="Email" /></div></ActionForm></Card>
        <div className="space-y-6">
          <Card title="🪙 Today’s gold rate (24K per gram)"><ActionForm action={saveGoldRate} submit="Save rate"><div className="grid grid-cols-2 gap-3"><Field label="Date"><input type="date" name="date" defaultValue={todayStr()} className="input" /></Field><Field label="Rate ₹/g"><input name="rate" type="number" step="0.01" className="input num" required /></Field></div></ActionForm><p className="mt-3 text-xs text-slate-500">Recent: {rates.map((r) => `${r.date.slice(5)} ₹${r.rate_24k}`).join(' · ')}</p></Card>
          <Card title="🧾 GST & invoice numbering"><ActionForm action={saveSettings} resetOnOk={false}>{group(['gst_jewellery', 'gst_making', 'hsn_jewellery', 'invoice_prefix_gst', 'invoice_prefix_gold', 'invoice_prefix_cash'])}<div className="grid gap-3 sm:grid-cols-3"><F S={S} k="gst_jewellery" label="Jewellery GST %" /><F S={S} k="gst_making" label="Making GST %" /><F S={S} k="hsn_jewellery" label="Default HSN" /><F S={S} k="invoice_prefix_gst" label="GST prefix" /><F S={S} k="invoice_prefix_gold" label="Gold bill prefix" /><F S={S} k="invoice_prefix_cash" label="Cash bill prefix" /></div></ActionForm></Card>
          <Card title="🔐 Security"><ActionForm action={saveSettings} resetOnOk={false}>{group(['session_minutes', 'max_attempts', 'ip_enforce'])}<div className="grid gap-3 sm:grid-cols-3"><F S={S} k="session_minutes" label="Auto-logout (min idle)" /><F S={S} k="max_attempts" label="Lock after wrong tries" /><Field label="IP restriction"><select name="ip_enforce" defaultValue={S.ip_enforce} className="input"><option value="0">Off</option><option value="1">On (approved IPs only)</option></select></Field></div><p className="mt-2 text-xs text-amber-700">Add your own IP in Users, Roles &amp; IP before switching ON.</p></ActionForm></Card>
          <Card title="📱 OTP / SMS gateway"><ActionForm action={saveSettings} resetOnOk={false}>{group(['sms_webhook'])}<F S={S} k="sms_webhook" label="SMS gateway URL (POST {mobile, message})" hint="Your DLT-registered SMS provider endpoint. Used for business-owner app login OTP." /></ActionForm></Card>
          <Card title="💬 WhatsApp agent (Meta Cloud API)"><ActionForm action={saveSettings} resetOnOk={false}>{group(['wa_owner_number', 'wa_phone_id', 'wa_token', 'wa_verify_token', 'wa_app_secret'])}<div className="grid gap-3 sm:grid-cols-2"><F S={S} k="wa_owner_number" label="Owner WhatsApp number" hint="10-digit, only this number gets owner access" /><F S={S} k="wa_phone_id" label="Phone number ID" /><Field label="Permanent access token"><input name="wa_token" type="password" defaultValue={S.wa_token || ''} className="input" /></Field><F S={S} k="wa_verify_token" label="Webhook verify token" /><Field label="Meta app secret (verifies webhook calls)"><input name="wa_app_secret" type="password" defaultValue={S.wa_app_secret || ''} className="input" /></Field></div><p className="mt-2 text-xs text-slate-500">Webhook URL: <code>https://YOUR-DOMAIN/api/whatsapp</code>. Business owners are matched by the mobile number saved on their party.</p></ActionForm></Card>
        </div>
      </div>
    </>
  );
}
