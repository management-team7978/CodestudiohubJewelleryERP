import { HelpPanel } from './HelpPanel';
import Link from 'next/link';

export function PageHeader({ title, subtitle, help, children, id }: { title: string; subtitle?: string; help?: { steps: string[]; tip?: string }; children?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-6 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0"><h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 no-print sm:w-auto">{children}</div>
      </div>
      {help && <HelpPanel id={id || title} steps={help.steps} tip={help.tip} />}
    </div>
  );
}
export function Card({ title, action, children, className = '', pad = true }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {title && <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5"><h2 className="text-sm font-bold text-ink-800">{title}</h2>{action}</header>}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}
export function Stat({ label, value, sub, tone = 'brand', icon }: { label: string; value: string; sub?: string; tone?: 'brand' | 'leaf' | 'gold' | 'rose'; icon?: React.ReactNode }) {
  const t = { brand: 'bg-brand-50 text-brand-600', leaf: 'bg-leaf-50 text-leaf-600', gold: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600' }[tone];
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t}`}>{icon}</div>
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="num mt-0.5 break-words text-xl font-extrabold text-ink-900 sm:text-2xl">{value}</p>{sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}</div>
    </div>
  );
}
const TONES: Record<string, string> = {
  New: 'bg-slate-100 text-slate-700', 'In Process': 'bg-brand-50 text-brand-700', Ready: 'bg-amber-50 text-amber-700', Delivered: 'bg-leaf-50 text-leaf-700', Cancelled: 'bg-rose-50 text-rose-700',
  Pending: 'bg-amber-50 text-amber-700', Active: 'bg-brand-50 text-brand-700', Done: 'bg-leaf-50 text-leaf-700', Received: 'bg-leaf-50 text-leaf-700', Issued: 'bg-brand-50 text-brand-700',
  GST: 'bg-brand-50 text-brand-700', GOLD: 'bg-amber-50 text-amber-700', CASH: 'bg-leaf-50 text-leaf-700', Generated: 'bg-leaf-50 text-leaf-700', Failed: 'bg-rose-50 text-rose-700', NA: 'bg-slate-100 text-slate-500',
};
export const Badge = ({ children }: { children: string }) => <span className={`chip ${TONES[children] || 'bg-slate-100 text-slate-700'}`}>{children}</span>;
export function Empty({ title, hint, href, cta }: { title: string; hint: string; href?: string; cta?: string }) {
  return (<div className="grid place-items-center px-6 py-12 text-center"><div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl">✨</div><p className="font-bold text-ink-800">{title}</p><p className="mt-1 max-w-sm text-sm text-slate-500">{hint}</p>{href && <Link href={href} className="btn-primary mt-4">{cta}</Link>}</div>);
}
export function Table({ head, children, right = [] }: { head: string[]; children: React.ReactNode; right?: number[] }) {
  return (<div className="w-full max-w-full overflow-x-auto"><table className="w-full"><thead className="bg-slate-50/70"><tr>{head.map((h, i) => <th key={h} className={`th whitespace-nowrap ${right.includes(i) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>);
}
export const Td = ({ children, right, className = '' }: { children?: React.ReactNode; right?: boolean; className?: string }) => <td className={`td ${right ? 'num text-right' : ''} ${className}`}>{children}</td>;
