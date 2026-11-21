'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type Res = { ok: boolean; msg: string } | null;
export function ActionForm({ action, children, submit = 'Save', className = '', resetOnOk = true, tone = 'primary' }: {
  action: (s: Res, f: FormData) => Promise<{ ok: boolean; msg: string }>; children: React.ReactNode; submit?: string; className?: string; resetOnOk?: boolean; tone?: 'primary' | 'green';
}) {
  const [state, fn, pending] = useActionState(action, null as Res);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnOk) ref.current?.reset(); }, [state, resetOnOk]);
  return (
    <form ref={ref} className={className} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => fn(fd)); }}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={tone === 'green' ? 'btn-green' : 'btn-primary'} disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{submit}</button>
        {state && (
          <p className={`flex items-center gap-1.5 text-sm font-medium ${state.ok ? 'text-leaf-600' : 'text-rose-600'}`} role="status">
            {state.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{state.msg}
          </p>
        )}
      </div>
    </form>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (<label className={`block ${className}`}><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}</label>);
}
