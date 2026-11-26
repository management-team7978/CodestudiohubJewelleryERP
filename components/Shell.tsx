'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, LogOut, LayoutDashboard, Rocket, PackageCheck, Gem, Building2, Users, ArrowLeftRight, TrendingDown, Coins, Flame, BookOpen, Boxes, Receipt, FileCheck2, Palette, MessageSquare, ShieldCheck, ScrollText, Settings, DatabaseBackup, KeyRound, Smartphone } from 'lucide-react';
import { logoutAction } from '@/actions/core';

const ICONS: Record<string, any> = { dashboard: LayoutDashboard, guide: Rocket, orders: PackageCheck, jewels: Gem, departments: Building2, karigars: Users, transfers: ArrowLeftRight, loss: TrendingDown, gold: Coins, melting: Flame, ledger: BookOpen, inventory: Boxes, billing: Receipt, gst: FileCheck2, designs: Palette, chat: MessageSquare, users: ShieldCheck, audit: ScrollText, settings: Settings, backup: DatabaseBackup, mobileapp: Smartphone };
export type NavItem = { key: string; label: string; href: string; group: string };

export function Shell({ nav, user, role, rate, children }: { nav: NavItem[]; user: string; role: string; rate: string; children: React.ReactNode }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const groups = [...new Set(nav.map((n) => n.group))];
  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex justify-center px-4 pb-3 pt-5"><Link href="/" onClick={() => setOpen(false)} className="block w-32"><Image src="/swastik-logo.png" alt="Swastik Jewellers" width={1024} height={792} priority className="h-auto w-full" /></Link></div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">{g}</p>
            {nav.filter((n) => n.group === g).map((n) => {
              const Icon = ICONS[n.key] || KeyRound; const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
              return (
                <Link key={n.key} href={n.href} onClick={() => setOpen(false)} data-tour={n.key}
                  className={`group mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>
                  <Icon className={`h-[18px] w-[18px] ${active ? '' : 'text-slate-400 group-hover:text-brand-500'}`} />{n.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-gold-500 text-sm font-bold text-white">{user[0]}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-ink-800">{user}</p><p className="text-xs text-slate-500">{role}</p></div></div>
        <form action={logoutAction}><button className="btn-ghost w-full"><LogOut className="h-4 w-4" />Sign out</button></form>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen min-w-0 lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-40 bg-ink-900/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`no-print fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</aside>
      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
        <button className="btn-ghost !px-2.5 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        <Link href="/" className="flex min-w-0 items-center gap-2 lg:hidden"><Image src="/swastik-logo.png" alt="Swastik Jewellers" width={1024} height={792} className="h-9 w-auto shrink-0" /><span className="hidden truncate text-sm font-extrabold text-ink-900 sm:inline">swastikjewellersERP</span></Link>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href="/settings" className="hidden items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700 sm:flex" title="Today's 24K gold rate — click to update"><Coins className="h-4 w-4" />24K ₹{rate}/g</Link>
          <Link href="/guide" className="btn-ghost !px-2.5 !py-1.5 sm:!px-4"><Rocket className="h-4 w-4" /><span className="hidden sm:inline">Guide</span></Link>
        </div>
      </header>
      <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
