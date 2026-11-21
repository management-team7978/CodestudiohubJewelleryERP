import fs from 'fs'; import path from 'path'; import { headers } from 'next/headers';
import { guard } from '@/lib/auth';
import { setSetting, setting } from '@/lib/db';
import { Card, PageHeader } from '@/components/ui';
import { ApkUpload, CopyLink } from '@/components/ApkUpload';
import { Download, Smartphone } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default async function MobileApp() {
  const s = await guard('mobileapp'); if (!s.isSuper) return null;
  const f = path.join(process.cwd(), 'data', 'apk', 'app.apk'); const has = fs.existsSync(f);
  if (!setting('apk_token')) setSetting('apk_token', crypto.randomUUID().replace(/-/g, ''));
  const h = await headers(); const origin = `${h.get('x-forwarded-proto') || 'http'}://${h.get('host')}`; const link = `${origin}/api/apk?t=${setting('apk_token')}`;
  return (
    <>
      <PageHeader title="Mobile App (Android APK)" subtitle="Download the business-owner app or share the install link" id="mobileapp" help={{ steps: ['Download the APK here to install on an Android phone (allow “install unknown apps” once).', 'Press “Copy share link” and send it to approved business owners on WhatsApp — the link works without a login.', 'When a new version is built, upload it with “Upload new APK”. The link stays the same.'], tip: 'iPhone users get the app from the App Store / TestFlight (needs your Apple developer account).' }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Current Android app">
          {has ? (<div className="space-y-3"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-leaf-50 text-leaf-600"><Smartphone /></div><div><p className="font-bold">{setting('apk_name')}</p><p className="text-sm text-slate-500">{(fs.statSync(f).size / 1048576).toFixed(1)} MB · uploaded {setting('apk_uploaded')}</p></div></div>
            <div className="flex flex-wrap gap-2"><a href="/api/apk" className="btn-green"><Download className="h-4 w-4" />Download APK</a><CopyLink link={link} /></div>
            <p className="break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{link}</p></div>) : <p className="text-sm text-slate-500">No APK uploaded yet. Build it (steps on the right) and upload it here.</p>}
          <div className="mt-5 border-t border-slate-100 pt-5"><ApkUpload /></div>
        </Card>
        <Card title="How to build the APK">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600"><li>On a computer: <code className="rounded bg-slate-100 px-1.5">cd mobile &amp;&amp; npm install</code></li><li>Set the server address: <code className="rounded bg-slate-100 px-1.5">EXPO_PUBLIC_API_URL=http://YOUR-SERVER-IP:3100</code></li><li>Build: <code className="rounded bg-slate-100 px-1.5">npx eas-cli build --platform android --profile preview</code> (free Expo account)</li><li>Download the finished <b>.apk</b> from the EAS link and upload it here.</li></ol>
        </Card>
      </div>
    </>
  );
}
