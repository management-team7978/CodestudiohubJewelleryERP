import fs from 'fs'; import path from 'path';
import { guard } from '@/lib/auth';
import { Card, PageHeader } from '@/components/ui';
import { BackupPanel } from '@/components/BackupPanel';
export const dynamic = 'force-dynamic';

export default async function Backup() {
  await guard('backup'); const dir = path.join(process.cwd(), 'backups');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse().map((f) => ({ f, kb: Math.round(fs.statSync(path.join(dir, f)).size / 1024) })) : [];
  return (
    <>
      <PageHeader title="Data Backup & Recovery" subtitle="Keep your gold records safe" id="backup" help={{ steps: ['Press “Backup now” for an instant, consistent copy of the whole database. The last 30 are kept.', 'Schedule the command below daily (cron) so backups run automatically, and copy the /backups folder to an external drive / NAS — not the same server.', 'To restore: stop the app, replace data/erp.db with a backup file, start the app.'] }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Create backup"><BackupPanel /><p className="mt-5 text-xs font-bold uppercase text-slate-400">Daily automatic backup (cron)</p><pre className="mt-1 overflow-x-auto rounded-xl bg-ink-900 p-3 text-xs text-slate-200">0 2 * * * cd /path/to/erp &amp;&amp; node scripts/backup.mjs</pre></Card>
        <Card title={`Saved backups (${files.length})`} pad={false}>{files.length ? <ul className="divide-y divide-slate-100 text-sm">{files.map((x) => <li key={x.f} className="flex justify-between px-5 py-2.5"><span>{x.f}</span><span className="text-slate-400">{x.kb} KB</span></li>)}</ul> : <p className="p-6 text-sm text-slate-400">No backups yet.</p>}</Card>
      </div>
    </>
  );
}
