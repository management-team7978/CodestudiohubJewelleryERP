'use client';
import { useEffect, useState } from 'react';
import { Eye, ShieldAlert, X } from 'lucide-react';
import { logDesignEvent } from '@/actions/core';

/** Web deterrents: tiled name+mobile watermark, blur when tab/window loses focus, PrintScreen / copy / right-click blocked & logged. */
export function DesignViewer({ id, code, title, category, weight, image, who }: { id: number; code: string; title: string; category: string; weight: number; image: string; who: string }) {
  const [open, setOpen] = useState(false); const [hidden, setHidden] = useState(false); const [alert, setAlert] = useState('');
  useEffect(() => {
    if (!open) return;
    const trip = (ev: string, msg: string) => { setAlert(msg); setHidden(true); logDesignEvent(id, ev); setTimeout(() => setHidden(false), 2500); };
    const key = (e: KeyboardEvent) => { if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) || ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase()))) { e.preventDefault(); trip('screenshot-attempt', 'Screenshot attempt detected and recorded.'); } };
    const vis = () => { if (document.hidden) setHidden(true); else setHidden(false); }; const blur = () => setHidden(true); const focus = () => setHidden(false);
    const ctx = (e: Event) => { e.preventDefault(); logDesignEvent(id, 'context-menu'); };
    logDesignEvent(id, 'view');
    window.addEventListener('keydown', key); document.addEventListener('visibilitychange', vis); window.addEventListener('blur', blur); window.addEventListener('focus', focus); document.addEventListener('contextmenu', ctx); document.addEventListener('copy', ctx);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); document.removeEventListener('contextmenu', ctx); document.removeEventListener('copy', ctx); };
  }, [open, id]);
  const mark = Array.from({ length: 24 }, (_, i) => <span key={i} className="whitespace-nowrap px-6 py-8 text-sm font-bold text-white/35">{who}</span>);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost w-full"><Eye className="h-4 w-4" />View design</button>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-900/80 p-4 select-none" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-3 z-20 rounded-full bg-white/90 p-1.5" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            <div className={`relative aspect-square overflow-hidden transition ${hidden ? 'blur-3xl' : ''}`}>
              {image ? <img src={image} alt={title} className="h-full w-full object-cover" draggable={false} /> : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-amber-200 via-amber-400 to-brand-500 text-6xl">💍</div>}
              <div className="pointer-events-none absolute inset-0 flex -rotate-[25deg] scale-150 flex-wrap content-center justify-center">{mark}</div>
            </div>
            {hidden && <div className="absolute inset-0 z-10 grid place-items-center bg-ink-900/85 p-6 text-center text-white"><div><ShieldAlert className="mx-auto h-10 w-10 text-rose-400" /><p className="mt-2 font-bold">{alert || 'Design hidden while the window is not in focus'}</p></div></div>}
            <div className="p-5"><p className="text-lg font-extrabold">{title} <span className="text-slate-400">· {code}</span></p><p className="text-sm text-slate-500">{category} · {weight} g</p><p className="mt-2 text-xs text-slate-400">Protected view — your name &amp; mobile are on every design; attempts are recorded.</p></div>
          </div>
        </div>
      )}
    </>
  );
}
