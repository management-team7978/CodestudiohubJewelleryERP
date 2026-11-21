'use client';
import { useState } from 'react';
import { DatabaseBackup, Loader2 } from 'lucide-react';
export function BackupPanel() {
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); const r = await fetch('/api/backup', { method: 'POST' }); const j = await r.json(); setMsg(j.msg); setBusy(false); setTimeout(() => location.reload(), 900); };
  return (<div><button className="btn-primary" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}Backup now</button>{msg && <p className="mt-3 text-sm font-semibold text-leaf-600">{msg}</p>}</div>);
}
