'use client';
import { useEffect, useState } from 'react';
import { HelpCircle, ChevronDown, Lightbulb } from 'lucide-react';

/** "How to use this page" — open by default the first time, remembers if you closed it. */
export function HelpPanel({ id, steps, tip }: { id: string; steps: string[]; tip?: string }) {
  const key = 'help:' + id; const [open, setOpen] = useState(true); const [ready, setReady] = useState(false);
  useEffect(() => { try { const v = localStorage.getItem(key); if (v !== null) setOpen(v === '1'); } catch {} setReady(true); }, [key]);
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem(key, n ? '1' : '0'); } catch {} };
  return (
    <div className={`no-print mt-4 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-leaf-50/60 ${ready ? '' : 'opacity-0'}`}>
      <button onClick={toggle} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-brand-800" aria-expanded={open}>
        <HelpCircle className="h-4 w-4" /> How to use this page <ChevronDown className={`ml-auto h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <ol className="space-y-1.5">{steps.map((s, i) => (<li key={i} className="flex gap-3 text-sm text-slate-700"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">{i + 1}</span><span>{s}</span></li>))}</ol>
          {tip && <p className="mt-3 flex gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-600"><Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />{tip}</p>}
        </div>
      )}
    </div>
  );
}
