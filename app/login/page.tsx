'use client';
import Image from 'next/image';
import { ActionForm, Field } from '@/components/Form';
import { loginAction } from '@/actions/core';
import { Coins, ShieldCheck, TrendingDown } from 'lucide-react';

export default function Login() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" /><div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-leaf-500/30 blur-3xl" />
        <div className="relative rounded-2xl bg-white p-3 w-fit"><Image src="/logo.png" alt="CodeStudioHub" width={200} height={76} priority /></div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">Every gram of gold,<br />tracked to the milligram.</h1>
          <ul className="mt-8 space-y-4 text-slate-300">
            <li className="flex items-center gap-3"><Coins className="text-amber-300" />Touch → fine gold, melting &amp; karigar balances</li>
            <li className="flex items-center gap-3"><TrendingDown className="text-rose-300" />Department-wise loss booking &amp; analytics</li>
            <li className="flex items-center gap-3"><ShieldCheck className="text-leaf-500" />Gold / Cash / GST bills with e-Invoice</li>
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">Innovative way to Develop · codestudiohub.com</p>
      </div>
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <Image src="/logo.png" alt="CodeStudioHub" width={160} height={60} className="mb-8 h-auto w-40 lg:hidden" />
          <h2 className="text-3xl font-extrabold text-ink-900">Welcome back</h2><p className="mb-6 mt-1 text-slate-500">Sign in to your Jewellery ERP</p>
          <ActionForm action={loginAction} submit="Sign in" resetOnOk={false} className="space-y-4">
            <Field label="Email"><input name="email" type="email" className="input" placeholder="you@shop.com" autoComplete="username" required /></Field>
            <Field label="Password"><input name="password" type="password" className="input" autoComplete="current-password" required /></Field>
          </ActionForm>
          {process.env.NEXT_PUBLIC_SHOW_DEMO !== '0' && <div className="mt-8 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-xs text-slate-600">
            <p className="mb-1 font-bold text-brand-700">Demo logins (first-time setup)</p>
            <p>Super Admin: <b>admin@erp.local</b> / <b>Admin@123</b></p><p>Accountant: <b>accounts@erp.local</b> / <b>Accounts@123</b></p>
            <p className="mt-1 text-slate-400">Change these in Users, Roles &amp; IP after login.</p>
          </div>}
        </div>
      </div>
    </div>
  );
}
