'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { finishOnboarding } from '@/actions/core';
import { ArrowRight, Check, X } from 'lucide-react';

const STEPS = [
  { t: 'Welcome to swastikjewellersERP', b: 'This short tour (1 minute) shows how everything fits together. You can reopen it anytime from Guide → “Restart tour”.', e: '👋' },
  { t: 'Step 1 — Set up your shop', b: 'Open Settings and fill in company name, GSTIN, address and today’s gold rate. These appear on every bill.', e: '🏪', go: '/settings', cta: 'Open Settings' },
  { t: 'Step 2 — Departments & Karigars', b: 'Add the departments gold passes through (Casting, Filing, Setting…) and your karigars. Each karigar gets their own gold balance.', e: '🛠️', go: '/departments', cta: 'Open Departments' },
  { t: 'Step 3 — Jewel flow', b: 'In Jewel Master pick the order of departments for each jewel type. New orders then move department by department automatically.', e: '💍', go: '/jewels', cta: 'Open Jewel Master' },
  { t: 'Gold in, in “fine”', b: 'In Gold Desk enter weight and touch (e.g. 75). The software computes FINE gold = weight × touch ÷ 100 and credits that party’s gold ledger. Melting mixes many touches into one.', e: '⚖️', go: '/gold', cta: 'Open Gold Desk' },
  { t: 'Track every gram — and every loss', b: 'Transfers move gold store → department → karigar (receiver confirms). Loss Booking records the milligram difference at shift end or any time, and graphs show where gold leaks.', e: '📉', go: '/loss', cta: 'Open Loss Booking' },
  { t: 'Bill your way', b: 'Make a Gold Bill (settle in fine gold), a Cash Bill, or a GST Invoice. GST invoices can be pushed straight to the e-Invoice portal, or downloaded as JSON.', e: '🧾', go: '/billing', cta: 'Open Billing' },
  { t: 'You’re ready!', b: 'Every page has a “How to use this page” box with steps. Look for it whenever you’re unsure. The Guide page shows a checklist of what’s left to set up.', e: '🎉' },
];

export function Tour({ name }: { name: string }) {
  const [i, setI] = useState(0); const [gone, setGone] = useState(false); const s = STEPS[i]; const last = i === STEPS.length - 1;
  if (gone) return null;
  const close = async () => { setGone(true); await finishOnboarding(); };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-brand-50 via-white to-leaf-50 px-5 pb-6 pt-8 sm:px-8">
          <button onClick={close} className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Skip tour"><X className="h-5 w-5" /></button>
          {i === 0 && <Image src="/swastik-logo.png" alt="Swastik Jewellers" width={1024} height={792} className="mb-4 h-auto w-28" />}
          <div className="text-5xl">{s.e}</div>
          <h2 className="mt-4 text-2xl font-extrabold text-ink-900">{i === 0 ? `Hi ${name.split(' ')[0]}! ` : ''}{s.t}</h2>
          <p className="mt-2 leading-relaxed text-slate-600">{s.b}</p>
          {s.go && <Link href={s.go} onClick={close} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600 hover:underline">{s.cta} <ArrowRight className="h-4 w-4" /></Link>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <div className="flex gap-1.5">{STEPS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-brand-500' : 'w-1.5 bg-slate-200'}`} />)}</div>
          <div className="flex gap-2">
            {i > 0 && <button className="btn-ghost" onClick={() => setI(i - 1)}>Back</button>}
            {last ? <button className="btn-green" onClick={close}><Check className="h-4 w-4" />Start using</button> : <button className="btn-primary" onClick={() => setI(i + 1)}>Next <ArrowRight className="h-4 w-4" /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}
