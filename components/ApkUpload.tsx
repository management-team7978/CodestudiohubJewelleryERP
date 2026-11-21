'use client';
import { useState } from 'react';
import { Upload, Loader2, Copy } from 'lucide-react';
export function ApkUpload() {
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (f: File | undefined) => { if (!f) return; setBusy(true); const fd = new FormData(); fd.append('apk', f); const r = await fetch('/api/apk', { method: 'POST', body: fd }); const j = await r.json(); setMsg(j.msg); setBusy(false); if (j.ok) setTimeout(() => location.reload(), 800); };
  return (<div><label className="btn-primary cursor-pointer">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Upload new APK<input type="file" accept=".apk" className="hidden" onChange={(e) => go(e.target.files?.[0])} /></label>{msg && <p className="mt-2 text-sm font-semibold text-leaf-600">{msg}</p>}</div>);
}
export function CopyLink({ link }: { link: string }) {
  const [ok, setOk] = useState(false);
  return (<button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(link); setOk(true); setTimeout(() => setOk(false), 1500); }}><Copy className="h-4 w-4" />{ok ? 'Copied!' : 'Copy share link'}</button>);
}
