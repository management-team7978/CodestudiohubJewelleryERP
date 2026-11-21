import Link from 'next/link';
import { guard } from '@/lib/auth';
import { getDb, settings, todayStr } from '@/lib/db';
import { restartTour } from '@/actions/core';
import { Card, PageHeader } from '@/components/ui';
import { CheckCircle2, Circle, ArrowRight, PlayCircle } from 'lucide-react';
import fs from 'fs'; import path from 'path';
export const dynamic = 'force-dynamic';

export default async function Guide() {
  const s = await guard('guide'); const db = getDb(); const S = settings(); const c = (sql: string, ...a: any[]) => (db.prepare(sql).get(...a) as any).c as number;
  const backups = fs.existsSync(path.join(process.cwd(), 'backups')) ? fs.readdirSync(path.join(process.cwd(), 'backups')).length : 0;
  const steps = [
    { t: 'Company details & GSTIN', d: 'So bills and e-Invoice carry your correct details.', ok: !!S.company_gstin && !!S.company_name, href: '/settings', m: 'settings' },
    { t: 'Enter today’s gold rate', d: 'Used for gold valuation on ledgers and bills.', ok: c('SELECT COUNT(*) c FROM gold_rates WHERE date=?', todayStr()) > 0, href: '/settings', m: 'settings' },
    { t: 'Create departments', d: 'Melting, Casting, Filing, Polishing…', ok: c('SELECT COUNT(*) c FROM departments WHERE active=1') > 0, href: '/departments', m: 'departments' },
    { t: 'Add karigars', d: 'Each gets a personal gold balance.', ok: c("SELECT COUNT(*) c FROM users WHERE kind='karigar'") > 0, href: '/karigars', m: 'karigars' },
    { t: 'Set jewel flows', d: 'Route each jewel through departments.', ok: c("SELECT COUNT(*) c FROM jewel_types WHERE flow<>'[]'") > 0, href: '/jewels', m: 'jewels' },
    { t: 'Add customers / businesses', d: 'With GSTIN for B2B e-Invoice.', ok: c("SELECT COUNT(*) c FROM parties WHERE type!='SUPPLIER'") > 0, href: '/ledger', m: 'ledger' },
    { t: 'Record gold received (touch → fine)', d: 'Try 75 touch to see the fine calculation.', ok: c("SELECT COUNT(*) c FROM gold_ledger WHERE ref_type='receipt'") > 0, href: '/gold', m: 'gold' },
    { t: 'Create your first order', d: 'Then track it department by department.', ok: c('SELECT COUNT(*) c FROM orders') > 0, href: '/orders', m: 'orders' },
    { t: 'Make your first bill', d: 'Gold, Cash or GST invoice.', ok: c('SELECT COUNT(*) c FROM invoices') > 0, href: '/billing', m: 'billing' },
    { t: 'Take a backup', d: 'Always keep a safe copy.', ok: backups > 0, href: '/backup', m: 'backup' },
  ];
  const done = steps.filter((x) => x.ok).length;
  const gloss = [['Touch', 'Purity in percent. 75 touch = 75% pure gold. 91.6 = 22K, 99.9 = 24K.'], ['Fine gold', 'The pure gold inside any weight: Fine = Gross × Touch ÷ 100. 200 g at 75 touch = 150 g fine.'], ['Gross weight', 'Total weight on the scale, including alloy.'], ['Loss', 'Weight given minus weight received (plus dust recovered), valued in fine gold.'], ['Karigar balance', 'Gold currently with a worker. Reduces when they return work.'], ['IRN', 'Invoice Reference Number given by the government e-Invoice portal.']];
  const flows = [['Customer brings old gold', 'Gold Desk → Gold received (weight + touch) → fine is credited to their ledger.'], ['New order', 'Orders → New order → open it → Start / Complete each department.'], ['Issue gold to a karigar', 'Metal Transfer: Store → Department → Karigar; receiver confirms.'], ['End of day', 'Loss & Analytics → Book a loss (Shift end) for each karigar.'], ['Different touches to one bar', 'Melting → add lots → follow the alloy / pure-gold advice → record output.'], ['Deliver & bill', 'Billing → Gold / Cash / GST bill → Receipt. GST → send to e-Invoice portal.']];
  return (
    <>
      <PageHeader title="Getting Started" subtitle="Everything you need to run the software from day one" id="guide">
        <form action={restartTour}><button className="btn-ghost"><PlayCircle className="h-4 w-4" />Restart welcome tour</button></form>
      </PageHeader>
      <Card className="mb-6 bg-gradient-to-r from-brand-50 via-white to-leaf-50">
        <div className="flex items-center justify-between"><div><p className="text-lg font-extrabold">Setup checklist — {done} of {steps.length} done</p><p className="text-sm text-slate-500">Complete these once and you’re ready for daily work.</p></div><p className="text-3xl font-black text-brand-600">{Math.round((done / steps.length) * 100)}%</p></div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-leaf-500" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Checklist" pad={false}><ul className="divide-y divide-slate-100">{steps.map((x) => (<li key={x.t}><Link href={x.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">{x.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-leaf-500" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" />}<div className="flex-1"><p className={`text-sm font-bold ${x.ok ? 'text-slate-400 line-through' : ''}`}>{x.t}</p><p className="text-xs text-slate-500">{x.d}</p></div><ArrowRight className="h-4 w-4 text-slate-300" /></Link></li>))}</ul></Card>
        <div className="space-y-6">
          <Card title="Daily work — what to click"><ul className="space-y-3">{flows.map(([a, b]) => <li key={a} className="text-sm"><p className="font-bold text-ink-800">{a}</p><p className="text-slate-500">{b}</p></li>)}</ul></Card>
          <Card title="Words you’ll see"><dl className="space-y-3">{gloss.map(([a, b]) => <div key={a} className="text-sm"><dt className="font-bold text-brand-700">{a}</dt><dd className="text-slate-500">{b}</dd></div>)}</dl></Card>
        </div>
      </div>
    </>
  );
}
