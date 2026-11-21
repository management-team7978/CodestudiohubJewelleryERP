import { requireSession, permOf, ip, ipAllowed } from '@/lib/auth';
import { getDb, setting } from '@/lib/db';
import { Shell, NavItem } from '@/components/Shell';
import { Tour } from '@/components/Tour';
import { redirect } from 'next/navigation';

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', group: 'Overview' }, { key: 'guide', label: 'Getting Started', href: '/guide', group: 'Overview' },
  { key: 'orders', label: 'Orders', href: '/orders', group: 'Production' }, { key: 'jewels', label: 'Jewel Master', href: '/jewels', group: 'Production' },
  { key: 'departments', label: 'Departments', href: '/departments', group: 'Production' }, { key: 'karigars', label: 'Karigars', href: '/karigars', group: 'Production' },
  { key: 'transfers', label: 'Metal Transfer', href: '/transfers', group: 'Production' }, { key: 'loss', label: 'Loss & Analytics', href: '/loss', group: 'Production' },
  { key: 'gold', label: 'Gold Desk (Touch → Fine)', href: '/gold', group: 'Gold' }, { key: 'melting', label: 'Melting', href: '/melting', group: 'Gold' },
  { key: 'ledger', label: 'Gold & Cash Ledger', href: '/ledger', group: 'Gold' }, { key: 'inventory', label: 'Inventory', href: '/inventory', group: 'Gold' },
  { key: 'billing', label: 'Billing & Receipts', href: '/billing', group: 'Accounts' }, { key: 'gst', label: 'GST & e-Invoice', href: '/gst', group: 'Accounts' },
  { key: 'designs', label: 'Designs', href: '/designs', group: 'More' }, { key: 'chat', label: 'Chat', href: '/chat', group: 'More' },
  { key: 'users', label: 'Users, Roles & IP', href: '/users', group: 'Admin' }, { key: 'audit', label: 'Audit Log', href: '/audit', group: 'Admin' },
  { key: 'settings', label: 'Settings', href: '/settings', group: 'Admin' }, { key: 'backup', label: 'Backup', href: '/backup', group: 'Admin' }, { key: 'mobileapp', label: 'Mobile App (APK)', href: '/mobile-app', group: 'Admin' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  if (!ipAllowed(await ip()) && !s.isSuper) redirect('/login');
  const nav = NAV.filter((n) => permOf(s, n.key).can_view);
  const r = getDb().prepare('SELECT rate_24k r FROM gold_rates ORDER BY date DESC LIMIT 1').get() as { r: number } | undefined;
  return (<Shell nav={nav} user={s.name} role={s.role} rate={r ? r.r.toLocaleString('en-IN') : '—'}>{children}{!s.onboarded && <Tour name={s.name} />}</Shell>);
}
